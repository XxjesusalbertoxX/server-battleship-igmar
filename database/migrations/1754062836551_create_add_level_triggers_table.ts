import { BaseSchema } from '@adonisjs/lucid/schema'

export default class AddLevelTrigger extends BaseSchema {
  protected tableName = 'users'

  async up() {
    // Crear la función para actualizar nivel
    await this.db.rawQuery(`
      CREATE OR REPLACE FUNCTION update_user_level()
      RETURNS TRIGGER AS $$
      BEGIN
          -- Mientras tenga 1000 o más EXP, sube de nivel
          WHILE NEW.exp >= 1000 LOOP
              NEW.level := NEW.level + 1;
              NEW.exp := NEW.exp - 1000;
          END LOOP;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `)

    // Crear el trigger
    await this.db.rawQuery(`
      DROP TRIGGER IF EXISTS trigger_update_user_level ON users;
      CREATE TRIGGER trigger_update_user_level
          BEFORE UPDATE ON users
          FOR EACH ROW
          WHEN (OLD.exp IS DISTINCT FROM NEW.exp)
          EXECUTE FUNCTION update_user_level();
    `)
  }

  async down() {
    // Eliminar el trigger y la función
    await this.db.rawQuery('DROP TRIGGER IF EXISTS trigger_update_user_level ON users;')
    await this.db.rawQuery('DROP FUNCTION IF EXISTS update_user_level();')
  }
}
