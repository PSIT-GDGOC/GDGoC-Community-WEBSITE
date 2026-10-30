import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";

const email = (process.env.SUPERADMIN_EMAIL || "admin@gdgoc.dev").trim().toLowerCase();
const password = process.env.SUPERADMIN_PASSWORD || "Admin1234!";
const name = process.env.SUPERADMIN_NAME || "GDGoC Lead Admin";

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is required.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);

try {
  let user = await User.findOne({ email }).select("+password");
  const hashedPassword = await bcrypt.hash(password, 12);

  if (user) {
    user.role = "admin";
    user.password = hashedPassword;
    if (name && !user.name) user.name = name;
    await user.save();
    console.log(`[OK] Superadmin account '${email}' updated to role 'admin' with configured password.`);
  } else {
    user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      branch: "CSE",
      year: 4,
      bio: "GDGoC Chapter Lead & Administrator",
    });
    console.log(`[OK] Superadmin account '${email}' created successfully with role 'admin'.`);
  }
} catch (error) {
  console.error("[ERROR] Failed to seed superadmin:", error.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
