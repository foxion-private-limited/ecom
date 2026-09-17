import mongoose from "mongoose";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  memoryServer?: any;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000,
      dbName: "ecom",
    };

    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/ecom";
    console.log("[DB Connection] Connecting to:", uri);
    cached!.promise = (async () => {
      try {
        const m = await mongoose.connect(uri, opts);
        console.log(`[DB Connection] Successfully connected to database '${m.connection.db?.databaseName}'`);
        return m;
      } catch (primaryErr: any) {
        console.error("[DB Connection] Primary MongoDB connection failed:", primaryErr.message);
        if (process.env.NODE_ENV !== "production" && !process.env.MONGODB_URI) {
          try {
            const { MongoMemoryServer } = await import("mongodb-memory-server");
            if (!cached!.memoryServer) {
              cached!.memoryServer = await MongoMemoryServer.create();
            }
            const memUri = cached!.memoryServer.getUri();
            console.log(`[DB Connection] Falling back to MongoMemoryServer: ${memUri}`);
            const m = await mongoose.connect(memUri, { bufferCommands: false, dbName: "ecom" });
            return m;
          } catch (memErr) {
            console.error("[DB Connection] MongoMemoryServer startup failed:", memErr);
            throw primaryErr;
          }
        }
        throw primaryErr;
      }
    })();
  }

  try {
    cached!.conn = await cached!.promise;
    if (process.env.NODE_ENV !== "production" && cached!.memoryServer) {
      try {
        const { User } = await import("@/lib/models/User");
        const admin = await User.findOne({ email: "admin@foxion.in" });
        if (!admin) {
          console.log("[Foxion DB] Initializing clean admin user and standard taxonomy...");
          const { runSeed } = await import("@/scripts/seed");
          await runSeed({ clearDummyData: false });
        }
      } catch (seedErr) {
        console.warn("[Foxion DB] Auto-seed warning:", seedErr);
      }
    }
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}

export default connectDB;
