import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db/connection";
import { User, IUser } from "@/lib/models/User";

const COOKIE_NAME = "foxion_session";
const SECRET_KEY = process.env.AUTH_SECRET || "foxion_super_secret_jwt_key_min_32_chars_long_foxion_2026";
const encodedKey = new TextEncoder().encode(SECRET_KEY);

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decryptSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(user: IUser) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = await encryptSession({
    userId: (user._id as any).toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return decryptSession(token);
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<IUser | null> {
  const session = await getSession();
  if (!session?.userId) return null;

  await connectDB();
  return User.findById(session.userId).select("-passwordHash");
}
