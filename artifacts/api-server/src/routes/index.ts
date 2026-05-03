import { Router, type IRouter } from "express";
import healthRouter from "./health";
import focusRouter from "./focus";
import connectionsRouter from "./connections";
import tenantsRouter from "./tenants";
import reportsRouter from "./reports";
import { resolveTenant } from "../middlewares/tenant";

const router: IRouter = Router();

router.use(healthRouter);

// All tenant-scoped endpoints sit behind the resolver. The tenants router
// additionally enforces that the path tenantId matches the resolved tenant,
// so callers can only read summaries for the tenant they identify as.
router.use(resolveTenant);
router.use(tenantsRouter);
router.use(focusRouter);
router.use(connectionsRouter);
router.use(reportsRouter);

export default router;
