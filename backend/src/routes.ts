import { Router } from 'express';
import { authenticate } from './core/auth';
import { authRouter } from './modules/auth/routes';
import { usersRouter } from './modules/users/routes';
import { taxonomyRouter } from './modules/taxonomy/routes';
import { quizzesRouter } from './modules/quizzes/routes';
import { bankRouter } from './modules/bank/routes';
import { cohortsRouter } from './modules/cohorts/routes';
import { catalogRouter } from './modules/catalog/routes';
import { attemptsRouter } from './modules/attempts/routes';
import { gradingRouter } from './modules/grading/routes';
import { reviewsRouter } from './modules/reviews/routes';
import { gamificationRouter } from './modules/gamification/routes';
import { organizerRouter } from './modules/organizer/routes';
import { reportsRouter } from './modules/reports/routes';
import { adminRouter } from './modules/admin/routes';

export const apiRouter = Router();

// public
apiRouter.use('/auth', authRouter);

// everything below requires a valid access token
apiRouter.use(authenticate);
apiRouter.use(usersRouter);
apiRouter.use(taxonomyRouter);
apiRouter.use(quizzesRouter);
apiRouter.use(bankRouter);
apiRouter.use(cohortsRouter);
apiRouter.use(catalogRouter);
apiRouter.use(attemptsRouter);
apiRouter.use(gradingRouter);
apiRouter.use(reviewsRouter);
apiRouter.use(gamificationRouter);
apiRouter.use(organizerRouter);
apiRouter.use(reportsRouter);
apiRouter.use(adminRouter);
