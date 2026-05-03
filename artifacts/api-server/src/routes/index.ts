import { Router, type IRouter } from "express";
import healthRouter from "./health";
import focusRouter from "./focus";
import connectionsRouter from "./connections";
import { resolveTenant } from "../middlewares/tenant";

const router: IRouter = Router();

router.use(healthRouter);

// All FOCUS and connection endpoints require a tenant scope.
router.use(resolveTenant);
router.use(focusRouter);
router.use(connectionsRouter);

export default router;
