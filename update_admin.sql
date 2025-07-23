-- First, delete existing admin account if it exists
DELETE FROM users WHERE email = 'admin@gmail.com';

-- Insert fresh admin account
INSERT INTO users (user_id, username, email, password, role) 
VALUES (1, 'admin', 'admin@gmail.com', 'admin123', 'admin'); 