const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Test endpoint
app.get('/api/test', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password });

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        console.log('Query results:', results);

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = results[0];
        console.log('Found user:', { 
            user_id: user.user_id,
            email: user.email,
            role: user.role
        });

        // For now, do a direct password comparison
        const validPassword = password === user.password;
        console.log('Password check:', { 
            provided: password,
            stored: user.password,
            valid: validPassword
        });

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            role: user.role
        });
    });
});

// Signup endpoint
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user already exists
    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // Get the next user_id
        db.query('SELECT MAX(user_id) as maxId FROM users', (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            const nextUserId = (results[0].maxId || 0) + 1;
            const role = email.includes('admin') ? 'admin' : 'user';

            // Insert new user with plain password for now
            const insertQuery = 'INSERT INTO users (user_id, username, email, password, role) VALUES (?, ?, ?, ?, ?)';
            db.query(insertQuery, [nextUserId, username, email, password, role], (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Error creating user' });
                }

                res.status(201).json({
                    message: 'User created successfully',
                    user_id: nextUserId,
                    username,
                    email,
                    role
                });
            });
        });
    });
});

// Save quiz endpoint - Simplified version
app.post('/api/save-quiz', async (req, res) => {
    try {
        console.log('Received quiz data:', JSON.stringify(req.body, null, 2));
        
        const { title, time_limit, description, questions } = req.body;
        
        if (!title || !questions || questions.length === 0) {
            return res.status(400).json({ error: 'Quiz title and at least one question are required' });
        }
        
        // Get the next quiz_id
        db.query('SELECT MAX(quiz_id) as maxId FROM quizzes', (err, results) => {
            if (err) {
                console.error('Error getting next quiz_id:', err);
                return res.status(500).json({ error: 'Database error: ' + err.message });
            }
            
            const nextQuizId = (results[0].maxId || 0) + 1;
            const totalMarks = questions.length * 10;
            const quizDescription = `${title} Quiz questions`;
            
            console.log('Inserting quiz:', { nextQuizId, title, quizDescription, totalMarks });
            
            // Insert quiz
            const insertQuizQuery = 'INSERT INTO quizzes (quiz_id, quiz_name, quiz_description, total_marks) VALUES (?, ?, ?, ?)';
            db.query(insertQuizQuery, [nextQuizId, title, quizDescription, totalMarks], (err, result) => {
                if (err) {
                    console.error('Error inserting quiz:', err);
                    return res.status(500).json({ error: 'Database error: ' + err.message });
                }
                
                console.log('Quiz inserted successfully:', result);
                
                // Process each question
                let processedQuestions = 0;
                
                questions.forEach((q, index) => {
                    // Get the next question_id
                    db.query('SELECT MAX(question_id) as maxId FROM questions', (err, results) => {
                        if (err) {
                            console.error('Error getting next question_id:', err);
                            return;
                        }
                        
                        const nextQuestionId = (results[0].maxId || 0) + 1;
                        
                        console.log('Inserting question:', { nextQuestionId, quizId: nextQuizId, question: q.question, correct: q.correct + 1 });
                        
                        // Insert question
                        const insertQuestionQuery = 'INSERT INTO questions (question_id, quiz_id, question_text, correct_option) VALUES (?, ?, ?, ?)';
                        db.query(insertQuestionQuery, [nextQuestionId, nextQuizId, q.question, q.correct + 1], (err, result) => {
                            if (err) {
                                console.error('Error inserting question:', err);
                                return;
                            }
                            
                            console.log('Question inserted successfully:', result);
                            
                            // Process each option
                            q.options.forEach((option, optionIndex) => {
                                // Get the next option_id
                                db.query('SELECT MAX(option_id) as maxId FROM options', (err, results) => {
                                    if (err) {
                                        console.error('Error getting next option_id:', err);
                                        return;
                                    }
                                    
                                    const nextOptionId = (results[0].maxId || 0) + 1;
                                    
                                    console.log('Inserting option:', { nextOptionId, questionId: nextQuestionId, option });
                                    
                                    // Insert option
                                    const insertOptionQuery = 'INSERT INTO options (option_id, question_id, option_text) VALUES (?, ?, ?)';
                                    db.query(insertOptionQuery, [nextOptionId, nextQuestionId, option], (err, result) => {
                                        if (err) {
                                            console.error('Error inserting option:', err);
                                            return;
                                        }
                                        
                                        console.log('Option inserted successfully:', result);
                                    });
                                });
                            });
                            
                            processedQuestions++;
                            
                            // If all questions are processed, send success response
                            if (processedQuestions === questions.length) {
                                res.status(201).json({
                                    message: 'Quiz saved successfully',
                                    quiz_id: nextQuizId,
                                    title,
                                    total_marks: totalMarks,
                                    questions_count: questions.length
                                });
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Unexpected error in save-quiz endpoint:', error);
        res.status(500).json({ error: 'Unexpected error: ' + error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 