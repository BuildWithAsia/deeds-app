-- Create deed_catalog table to store predefined deed templates
CREATE TABLE IF NOT EXISTS deed_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  impact TEXT NOT NULL,
  duration TEXT NOT NULL
);

-- Seed with community-focused deed templates
INSERT INTO deed_catalog (title, description, impact, duration) VALUES
  ('Support Hemp Farms in Haiti', 'Assist in developing sustainable hemp agriculture projects in Haiti.', 'Environment', 'Half day'),
  ('Family Census', 'Document and reconnect family members across generations.', 'Community care', '1-2 hours'),
  ('Sign a Petition for Local Reform', 'Support local reform through civic engagement and advocacy.', 'Education', 'Under 30 minutes'),
  ('Donate or Invest in a Local Project', 'Contribute financially or with skills to a community project.', 'Economic empowerment', '1-2 hours'),
  ('TikTok Challenge for Awareness', 'Create content to raise awareness for a social cause.', 'Community care', '30-60 minutes'),
  ('Neighborhood Clean-Up', 'Join or organize a community clean-up event to beautify shared spaces.', 'Environment', 'Half day'),
  ('Mentor a Student', 'Spend time helping a student with homework or career guidance.', 'Education', '1-2 hours');

-- Rollback
-- DROP TABLE deed_catalog;
