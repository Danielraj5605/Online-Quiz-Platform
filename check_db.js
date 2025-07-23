const mysql = require('mysql2');
require('dotenv').config();

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
    
    // Check if tables exist
    checkTables();
});

function checkTables() {
    // Check quizzes table
    db.query('DESCRIBE quizzes', (err, results) => {
        if (err) {
            console.error('Error checking quizzes table:', err);
            console.log('Quizzes table does not exist or has an error');
        } else {
            console.log('Quizzes table structure:');
            console.log(results);
        }
        
        // Check questions table
        db.query('DESCRIBE questions', (err, results) => {
            if (err) {
                console.error('Error checking questions table:', err);
                console.log('Questions table does not exist or has an error');
            } else {
                console.log('Questions table structure:');
                console.log(results);
            }
            
            // Check options table
            db.query('DESCRIBE options', (err, results) => {
                if (err) {
                    console.error('Error checking options table:', err);
                    console.log('Options table does not exist or has an error');
                } else {
                    console.log('Options table structure:');
                    console.log(results);
                }
                
                // Check if there's any data in the tables
                db.query('SELECT COUNT(*) as count FROM quizzes', (err, results) => {
                    if (err) {
                        console.error('Error counting quizzes:', err);
                    } else {
                        console.log(`Number of quizzes: ${results[0].count}`);
                    }
                    
                    db.query('SELECT COUNT(*) as count FROM questions', (err, results) => {
                        if (err) {
                            console.error('Error counting questions:', err);
                        } else {
                            console.log(`Number of questions: ${results[0].count}`);
                        }
                        
                        db.query('SELECT COUNT(*) as count FROM options', (err, results) => {
                            if (err) {
                                console.error('Error counting options:', err);
                            } else {
                                console.log(`Number of options: ${results[0].count}`);
                            }
                            
                            // Close the connection
                            db.end();
                        });
                    });
                });
            });
        });
    });
} 