// database/migrations/xxxx_create_user_level_trigger.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class CreateUserLevelTrigger extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION update_user_level()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.exp > OLD.exp THEN
          WHILE NEW.exp >= 500 LOOP
            NEW.exp := NEW.exp - 500;
            NEW.level := NEW.level + 1;
          END LOOP;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_update_level
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_user_level();
    `)
  }

  async down() {
    await this.db.rawQuery(`
      DROP TRIGGER IF EXISTS trg_update_level ON users;
      DROP FUNCTION IF EXISTS update_user_level();
    `)
  }
}
