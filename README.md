# Quizzo - Quiz Creation and Management System

A web-based quiz creation and management system built with Node.js, Express, and MySQL.

## Features

- User authentication (admin and regular users)
- Quiz creation with multiple-choice questions
- Automatic scoring based on correct answers
- Role-based access control

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm (Node Package Manager)

### Database Setup

1. Log in to MySQL:
   ```
   mysql -u root -p1234
   ```

2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS quizdb;
   USE quizdb;
   ```

3. Run the setup script:
   ```sql
   source setup_db.sql
   ```

### Application Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server:
   ```
   npm start
   ```

3. Access the application:
   Open your browser and navigate to `http://localhost:3000`

## Usage

### Admin Login

- Email: `admin@gmail.com`
- Password: `admin123`

### Creating a Quiz

1. Log in as an admin
2. Navigate to the "Create Quiz" page
3. Enter quiz title and time limit
4. Add questions with multiple-choice options
5. Select the correct answer for each question
6. Click "Save Quiz" to save the quiz to the database

### Taking a Quiz

1. Log in as a regular user
2. Select a quiz from the available quizzes
3. Answer the questions within the time limit
4. Submit the quiz to see your score

## Database Schema

### Users Table
- `user_id`: Primary key
- `username`: User's name
- `email`: User's email (unique)
- `password`: User's password
- `role`: User's role (admin or user)

### Quizzes Table
- `quiz_id`: Primary key
- `quiz_name`: Name of the quiz
- `quiz_description`: Description of the quiz
- `total_marks`: Total marks for the quiz
- `created_at`: Timestamp of creation

### Questions Table
- `question_id`: Primary key
- `quiz_id`: Foreign key to quizzes table
- `question_text`: The question text
- `correct_option`: Index of the correct option

### Options Table
- `option_id`: Primary key
- `question_id`: Foreign key to questions table
- `option_text`: The option text 