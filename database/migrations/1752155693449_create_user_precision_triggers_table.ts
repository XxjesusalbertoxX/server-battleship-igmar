// database/migrations/xxxx_create_user_precision_trigger.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateUserPrecisionTrigger extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION update_user_precision() RETURNS TRIGGER AS $$
      DECLARE
        uid INTEGER;
        total_moves INTEGER;
        total_hits INTEGER;
        new_precision NUMERIC;
      BEGIN
        SELECT user_id INTO uid
        FROM player_games
        WHERE id = NEW.player_game_id;

        SELECT COUNT(*) INTO total_moves
        FROM moves m
        JOIN player_games pg ON m.player_game_id = pg.id
        WHERE pg.user_id = uid;

        SELECT SUM((m.hit::int)) INTO total_hits
        FROM moves m
        JOIN player_games pg ON m.player_game_id = pg.id
        WHERE pg.user_id = uid;

        IF total_moves = 0 THEN
          new_precision := 0;
        ELSE
          new_precision := ROUND((total_hits::numeric / total_moves) * 100);
        END IF;

        UPDATE users
        SET precision = new_precision
        WHERE id = uid;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_update_user_precision
      AFTER INSERT ON moves
      FOR EACH ROW
      EXECUTE FUNCTION update_user_precision();
    `)
  }

  async down() {
    await this.db.rawQuery(`
      DROP TRIGGER IF EXISTS trg_update_user_precision ON moves;
      DROP FUNCTION IF EXISTS update_user_precision();
    `)
  }
}
