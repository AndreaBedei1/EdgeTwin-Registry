import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user"], default: "user" }
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform(_doc, ret) {
    const output = ret as Record<string, unknown>;
    delete output.passwordHash;
    delete output.__v;
    return ret;
  }
});

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: unknown };
export const UserModel = model("User", userSchema);
