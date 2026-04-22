import { Router } from "express";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import {
  admins, attendants, customers,
} from "@workspace/db";
import { db } from "../lib/db.js";
import { signToken, verifyToken, extractBearer } from "../lib/auth.js";
import { ok, created } from "../lib/response.js";
import { notFound, badRequest, unauthorized, conflict } from "../lib/errors.js";
import { requireAdmin, requireAttendant, requireAdminOrAttendant, requireCustomer } from "../middlewares/auth.js";
import {
  notifyAdminWelcome,
  notifyAdminEmailVerification,
  notifyAdminPasswordReset,
  notifyAdminPasswordChanged,
  notifyCustomerWelcome,
  notifyCustomerPasswordReset,
} from "../lib/emailEvents.js";

const router = Router();

const SUPER_ADMIN_EMAIL = process.env["SUPER_ADMIN_EMAIL"] ?? "";

function makeOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ── Admin Auth ────────────────────────────────────────────────────────────────

router.post("/admin/register", async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!email || !password || !name) throw badRequest("name, email and password are required");

    const existing = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (existing) throw conflict("Email already registered");

    const hashed = await bcrypt.hash(password, 10);
    const otp = makeOtp();
    const otpExpiry = Date.now() + 10 * 60 * 1000;

    const [admin] = await db.insert(admins).values({
      username: name,
      email,
      phone: phone ?? "",
      password: hashed,
      otp,
      otpExpiry,
    }).returning();

    const { password: _, otp: __, ...safeAdmin } = admin;

    notifyAdminWelcome(safeAdmin);
    notifyAdminEmailVerification(safeAdmin, otp, 10);

    return created(res, {
      ...safeAdmin,
      ...(process.env["NODE_ENV"] !== "production" ? { otp } : {}),
      message: "Registration successful. Verify your email with the OTP sent.",
    });
  } catch (e) { next(e); }
});

router.post("/admin/verify-email", async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw badRequest("email and otp required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (!admin) throw notFound("Admin not found");
    if (admin.otp !== otp) throw badRequest("Invalid OTP");
    if (admin.otpExpiry && admin.otpExpiry < Date.now()) throw badRequest("OTP expired");

    await db.update(admins).set({ emailVerified: true, otp: null, otpExpiry: null }).where(eq(admins.id, admin.id));
    return ok(res, { message: "Email verified successfully" });
  } catch (e) { next(e); }
});

router.post("/admin/resend-otp", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw badRequest("email required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (!admin) throw notFound("Admin not found");

    const otp = makeOtp();
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    await db.update(admins).set({ otp, otpExpiry }).where(eq(admins.id, admin.id));

    notifyAdminEmailVerification(admin, otp, 10);

    return ok(res, {
      message: "OTP resent",
      ...(process.env["NODE_ENV"] !== "production" ? { otp } : {}),
    });
  } catch (e) { next(e); }
});

router.post("/admin/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw badRequest("email and password required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (!admin) throw unauthorized("Invalid credentials");

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) throw unauthorized("Invalid credentials");

    const isSuperAdmin = SUPER_ADMIN_EMAIL ? admin.email === SUPER_ADMIN_EMAIL : false;

    const token = signToken({ role: "admin", id: admin.id, isSuperAdmin });
    const { password: _, otp: __, ...safeAdmin } = admin;

    return ok(res, { ...safeAdmin, isSuperAdmin, token });
  } catch (e) { next(e); }
});

router.post("/admin/forgot-password", async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw badRequest("email required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (!admin) throw notFound("No account with that email");

    const otp = makeOtp();
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    await db.update(admins).set({ otp, otpExpiry }).where(eq(admins.id, admin.id));

    notifyAdminPasswordReset(admin, `Use code: ${otp}`, 10);

    return ok(res, {
      message: "OTP sent to email",
      ...(process.env["NODE_ENV"] !== "production" ? { otp } : {}),
    });
  } catch (e) { next(e); }
});

router.post("/admin/reset-password", async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    if (!email || !otp || !password) throw badRequest("email, otp and password required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.email, email) });
    if (!admin) throw notFound("Admin not found");
    if (admin.otp !== otp) throw badRequest("Invalid OTP");
    if (admin.otpExpiry && admin.otpExpiry < Date.now()) throw badRequest("OTP expired");

    const hashed = await bcrypt.hash(password, 10);
    await db.update(admins).set({ password: hashed, otp: null, otpExpiry: null }).where(eq(admins.id, admin.id));
    notifyAdminPasswordChanged(admin);
    return ok(res, { message: "Password updated" });
  } catch (e) { next(e); }
});

router.post("/admin/reset-password-sms", async (req, res, next) => {
  try {
    const { phone, otp, password } = req.body;
    if (!phone || !otp || !password) throw badRequest("phone, otp and password required");

    const admin = await db.query.admins.findFirst({ where: eq(admins.phone, phone) });
    if (!admin) throw notFound("Admin not found");
    if (admin.otp !== otp) throw badRequest("Invalid OTP");
    if (admin.otpExpiry && admin.otpExpiry < Date.now()) throw badRequest("OTP expired");

    const hashed = await bcrypt.hash(password, 10);
    await db.update(admins).set({ password: hashed, otp: null, otpExpiry: null }).where(eq(admins.id, admin.id));
    notifyAdminPasswordChanged(admin);
    return ok(res, { message: "Password updated" });
  } catch (e) { next(e); }
});

router.post("/admin/save-local", requireAdmin, async (req, res, next) => {
  try {
    return ok(res, { message: "Credentials saved locally" });
  } catch (e) { next(e); }
});

router.post("/admin/logout", requireAdmin, async (_req, res, next) => {
  try {
    return ok(res, { message: "Logged out" });
  } catch (e) { next(e); }
});

// ── Attendant Auth ────────────────────────────────────────────────────────────

router.post("/attendant/login", async (req, res, next) => {
  try {
    const { pin, shopId } = req.body;
    if (!pin || !shopId) throw badRequest("pin and shopId required");

    const attendant = await db.query.attendants.findFirst({
      where: and(eq(attendants.pin, pin), eq(attendants.shop, Number(shopId))),
    });
    if (!attendant) throw unauthorized("Invalid PIN or shop");

    const token = signToken({ role: "attendant", id: attendant.id, shopId: Number(shopId) });
    const { pin: _, password: __, ...safeAttendant } = attendant;

    return ok(res, { ...safeAttendant, token });
  } catch (e) { next(e); }
});

router.post("/attendant/logout", requireAttendant, (_req, res, next) => {
  try {
    return ok(res, { message: "Logged out" });
  } catch (e) { next(e); }
});

// ── Me ────────────────────────────────────────────────────────────────────────

router.get("/me", requireAdminOrAttendant, async (req, res, next) => {
  try {
    if (req.admin) {
      const admin = await db.query.admins.findFirst({ where: eq(admins.id, req.admin.id) });
      if (!admin) throw notFound("Admin not found");
      const { password: _, otp: __, ...safe } = admin;
      return ok(res, { ...safe, isSuperAdmin: req.admin.isSuperAdmin, role: "admin" });
    }
    if (req.attendant) {
      const attendant = await db.query.attendants.findFirst({ where: eq(attendants.id, req.attendant.id) });
      if (!attendant) throw notFound("Attendant not found");
      const { pin: _, password: __, ...safe } = attendant;
      return ok(res, { ...safe, role: "attendant" });
    }
    throw unauthorized();
  } catch (e) { next(e); }
});

router.put("/me/last-seen", requireAdminOrAttendant, async (req, res, next) => {
  try {
    const now = new Date();
    if (req.admin) {
      await db.update(admins).set({ lastSeen: now }).where(eq(admins.id, req.admin.id));
    } else if (req.attendant) {
      await db.update(attendants).set({ lastSeen: now }).where(eq(attendants.id, req.attendant.id));
    }
    return ok(res, { message: "Last seen updated" });
  } catch (e) { next(e); }
});

// ── Customer Auth ─────────────────────────────────────────────────────────────

router.post("/customer/register", async (req, res, next) => {
  try {
    const { name, email, phone, password, shopId } = req.body;
    if (!name || !shopId) throw badRequest("name and shopId required");

    const hashed = password ? await bcrypt.hash(password, 10) : null;

    const [customer] = await db.insert(customers).values({
      name,
      email,
      phone,
      password: hashed ?? undefined,
      shop: Number(shopId),
      type: "online",
    }).returning();

    const { password: _, otp: __, ...safe } = customer;
    void notifyCustomerWelcome(safe);
    return created(res, safe);
  } catch (e) { next(e); }
});

router.get("/customer/me", requireCustomer, async (req, res, next) => {
  try {
    const customer = await db.query.customers.findFirst({ where: eq(customers.id, req.customer!.id) });
    if (!customer) throw notFound("Customer not found");
    const { password: _, otp: __, ...safe } = customer;
    return ok(res, safe);
  } catch (e) { next(e); }
});

router.post("/customer/login", async (req, res, next) => {
  try {
    const { emailOrPhone, password, shopId } = req.body;
    if (!emailOrPhone || !password || !shopId) throw badRequest("emailOrPhone, password and shopId required");

    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.shop, Number(shopId)),
        eq(customers.email, emailOrPhone),
      ),
    });
    if (!customer || !customer.password) throw unauthorized("Invalid credentials");

    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) throw unauthorized("Invalid credentials");

    const token = signToken({ role: "customer", id: customer.id });
    const { password: _, otp: __, ...safe } = customer;
    return ok(res, { ...safe, token });
  } catch (e) { next(e); }
});

router.post("/customer/forgot-password", async (req, res, next) => {
  try {
    const { emailOrPhone, shopId } = req.body;
    if (!emailOrPhone || !shopId) throw badRequest("emailOrPhone and shopId required");

    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.email, emailOrPhone), eq(customers.shop, Number(shopId))),
    });
    if (!customer) throw notFound("Customer not found");

    const otp = makeOtp();
    const otpExpiry = Date.now() + 10 * 60 * 1000;
    await db.update(customers).set({ otp, otpExpiry }).where(eq(customers.id, customer.id));

    void notifyCustomerPasswordReset(customer, `Use code: ${otp}`, 10);

    return ok(res, {
      message: "OTP sent",
      ...(process.env["NODE_ENV"] !== "production" ? { otp } : {}),
    });
  } catch (e) { next(e); }
});

router.post("/customer/reset-password", async (req, res, next) => {
  try {
    const { emailOrPhone, otp, password, shopId } = req.body;
    if (!emailOrPhone || !otp || !password || !shopId) throw badRequest("All fields required");

    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.email, emailOrPhone), eq(customers.shop, Number(shopId))),
    });
    if (!customer) throw notFound("Customer not found");
    if (customer.otp !== otp) throw badRequest("Invalid OTP");
    if (customer.otpExpiry && Number(customer.otpExpiry) < Date.now()) throw badRequest("OTP expired");

    const hashed = await bcrypt.hash(password, 10);
    await db.update(customers).set({ password: hashed, otp: null, otpExpiry: null }).where(eq(customers.id, customer.id));
    return ok(res, { message: "Password updated" });
  } catch (e) { next(e); }
});

export default router;
