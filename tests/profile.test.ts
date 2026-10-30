import assert from "node:assert";
import { emailError, safeNext, signupErrors, validatePassword, validateProfile } from "../src/lib/profile";

assert.equal(validateProfile({ name: "Asha", branch: "IT", year: 2 }), null);
assert.ok(validateProfile({ name: " a " }));
assert.ok(validateProfile({ name: "Asha", branch: "Hacking" }));
assert.ok(validateProfile({ name: "Asha", year: 7 }));
assert.ok(validateProfile({ name: "Asha", bio: "x".repeat(281) }));

assert.equal(validatePassword("old-pass1", "newpass12", "newpass12"), null);
assert.ok(validatePassword("", "newpass12", "newpass12"));
assert.ok(validatePassword("old", "short1", "short1"));
assert.ok(validatePassword("old", "lettersonly", "lettersonly"));
assert.ok(validatePassword("same1234", "same1234", "same1234"));
assert.ok(validatePassword("old", "newpass12", "newpass13"));

const ok = {
  name: "Asha",
  email: "a@psit.ac.in",
  password: "secret123",
  confirm: "secret123",
  branch: "",
  year: undefined,
};
assert.deepEqual(signupErrors(ok), {});
assert.deepEqual(Object.keys(signupErrors({ ...ok, name: "", email: "nope", confirm: "x" })), [
  "name",
  "email",
  "confirm",
]);
assert.deepEqual(
  Object.keys(signupErrors({ ...ok, password: "weak", confirm: "weak", branch: "X", year: 9 })),
  ["branch", "year", "password"],
);
assert.equal(emailError("a@b.co"), null);
assert.ok(emailError("a b@c.d"));

assert.equal(safeNext("/events"), "/events");
assert.equal(safeNext("//evil.com"), "/dashboard");
assert.equal(safeNext("https://evil.com"), "/dashboard");
assert.equal(safeNext(null), "/dashboard");

console.log("profile: all checks passed");
