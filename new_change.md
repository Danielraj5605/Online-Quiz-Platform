# Quiz Application – Functional Requirements Implementation Guide

## Overview

This document provides a step-by-step implementation plan to integrate all functional requirements into an existing quiz application.

---

## 1. User Management

### Features

* User Registration
* User Login/Logout
* Profile Management

### Implementation

* Create `users` table:

  * id (PK)
  * name
  * email (unique)
  * password (hashed)
  * created_at

* Backend:

  * API endpoints:

    * POST /register
    * POST /login
    * GET /profile
    * PUT /profile

* Use JWT for authentication

---

## 2. Quiz Management

### Features

* Create, Edit, Delete Quizzes

### Implementation

* Create `quizzes` table:

  * quiz_id (PK)
  * title
  * description
  * category
  * time_limit

* Backend APIs:

  * POST /quizzes
  * PUT /quizzes/{id}
  * DELETE /quizzes/{id}
  * GET /quizzes

---

## 3. Question Management

### Features

* Add/Edit/Delete Questions

### Implementation

* Create `questions` table:

  * question_id (PK)
  * quiz_id (FK)
  * question_text

* Create `options` table:

  * option_id (PK)
  * question_id (FK)
  * option_text
  * is_correct (boolean)

* Backend APIs:

  * POST /questions
  * PUT /questions/{id}
  * DELETE /questions/{id}

---

## 4. Quiz Attempt

### Features

* Start quiz
* Answer questions
* Submit quiz

### Implementation

* Create `responses` table:

  * response_id (PK)
  * user_id (FK)
  * question_id (FK)
  * selected_option_id

* Backend APIs:

  * POST /quiz/start
  * POST /quiz/submit

* Logic:

  * Load questions
  * Save answers per question
  * Prevent multiple active attempts

---

## 5. Timer Functionality

### Features

* Quiz time limit

### Implementation

* Store start_time when quiz begins
* Calculate remaining time on frontend
* Auto-submit when time expires

---

## 6. Scoring System

### Features

* Calculate score

### Implementation

* Create `scores` table:

  * score_id (PK)
  * user_id (FK)
  * quiz_id (FK)
  * total_score
  * correct_answers
  * attempted_at

* Logic:

  * Compare selected_option_id with correct option
  * Calculate total score

---

## 7. Results & Feedback

### Features

* Show results after submission

### Implementation

* API:

  * GET /results/{quiz_id}

* Include:

  * Score
  * Correct answers
  * User answers

---

## 8. Leaderboard

### Features

* Rank users

### Implementation

* Query:

  * ORDER BY total_score DESC

* API:

  * GET /leaderboard/{quiz_id}

---

## 9. Attempt History

### Features

* View past attempts

### Implementation

* API:

  * GET /history/{user_id}

* Display:

  * Quiz name
  * Score
  * Date

---

## 10. Admin Dashboard

### Features

* Manage quizzes, users, results

### Implementation

* Admin APIs:

  * GET /admin/users
  * GET /admin/quizzes
  * GET /admin/analytics

* Optional:

  * Charts for performance

---

## 11. Validation Rules

* Email must be unique
* All questions must have one correct answer
* Prevent duplicate submissions
* Validate inputs on frontend + backend

---

## 12. Folder Structure (Suggested)

```
/frontend
  /pages
  /components
  /services

/backend
  /routes
  /controllers
  /models
  /database
```

---

## 13. Tech Stack

### Frontend

* HTML / CSS / JavaScript / Bootstrap or React

### Backend

* FastAPI (Python)

### Database

* MySQL

---

## 14. Future Enhancements

* Randomized questions
* Negative marking
* Difficulty levels
* AI-based recommendations

---

## Conclusion

This document provides a complete implementation roadmap for integrating all functional requirements into the quiz application. Follow each module step-by-step to build a scalable and maintainable system.
