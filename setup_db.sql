-- Create quizzes table if it doesn't exist
CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id INT PRIMARY KEY AUTO_INCREMENT,
    quiz_name VARCHAR(100) NOT NULL,
    quiz_description TEXT,
    total_marks INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS questions (
    question_id INT PRIMARY KEY AUTO_INCREMENT,
    quiz_id INT,
    question_text TEXT NOT NULL,
    correct_option INT,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(quiz_id)
);

-- Create options table if it doesn't exist
CREATE TABLE IF NOT EXISTS options (
    option_id INT PRIMARY KEY AUTO_INCREMENT,
    question_id INT,
    option_text VARCHAR(255) NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(question_id)
);

-- Insert sample data if tables are empty
INSERT INTO quizzes (quiz_id, quiz_name, quiz_description, total_marks)
SELECT 1, 'General Knowledge', 'Basic GK Quiz', 100
WHERE NOT EXISTS (SELECT 1 FROM quizzes WHERE quiz_id = 1);

INSERT INTO quizzes (quiz_id, quiz_name, quiz_description, total_marks)
SELECT 2, 'History Quiz', 'Quiz about historical events', 10
WHERE NOT EXISTS (SELECT 1 FROM quizzes WHERE quiz_id = 2);

INSERT INTO quizzes (quiz_id, quiz_name, quiz_description, total_marks)
SELECT 3, 'Math Quiz', 'Basic math questions', 10
WHERE NOT EXISTS (SELECT 1 FROM quizzes WHERE quiz_id = 3);

INSERT INTO quizzes (quiz_id, quiz_name, quiz_description, total_marks)
SELECT 4, 'Science Quiz', 'General science knowledge', 10
WHERE NOT EXISTS (SELECT 1 FROM quizzes WHERE quiz_id = 4);

-- Insert sample questions if they don't exist
INSERT INTO questions (question_id, quiz_id, question_text, correct_option)
SELECT 1, 1, 'What is the capital of India?', 1
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE question_id = 1);

INSERT INTO questions (question_id, quiz_id, question_text, correct_option)
SELECT 2, 1, 'What is the capital of France?', 2
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE question_id = 2);

INSERT INTO questions (question_id, quiz_id, question_text, correct_option)
SELECT 3, 1, 'Who is known as the Father of Computers?', 3
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE question_id = 3);

-- Insert sample options if they don't exist
INSERT INTO options (option_id, question_id, option_text)
SELECT 1, 1, 'New Delhi'
WHERE NOT EXISTS (SELECT 1 FROM options WHERE option_id = 1);

INSERT INTO options (option_id, question_id, option_text)
SELECT 2, 1, 'Mumbai'
WHERE NOT EXISTS (SELECT 1 FROM options WHERE option_id = 2);

INSERT INTO options (option_id, question_id, option_text)
SELECT 3, 1, 'Kolkata'
WHERE NOT EXISTS (SELECT 1 FROM options WHERE option_id = 3);

INSERT INTO options (option_id, question_id, option_text)
SELECT 4, 1, 'Chennai'
WHERE NOT EXISTS (SELECT 1 FROM options WHERE option_id = 4); 