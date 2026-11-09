import test from "node:test";
import assert from "node:assert/strict";
import User, { publicUser } from "./models/User.js";
import { executeDbFirstMediaClear } from "./routes/users.js";
import {
  BANNER_THEMES,
  ACCENT_COLORS,
  CARD_THEMES,
  validateProjectInput,
  validateSkillsInput,
  validateSocialsInput,
  isValidUrl,
} from "./utils/domain.js";

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";

async function jsonFetch(url, options = {}) {
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

test("Dynamic Identity Hub - Domain Validations", () => {
  // Safe URL validation
  assert.equal(isValidUrl("https://github.com/octocat"), true);
  assert.equal(isValidUrl("http://myportfolio.dev"), true);
  assert.equal(isValidUrl(""), true);
  assert.equal(isValidUrl(null), true);
  assert.equal(isValidUrl("javascript:alert(1)"), false);
  assert.equal(isValidUrl("ftp://files.example.com"), false);
  assert.equal(isValidUrl("just-a-string"), false);

  // Project input validation
  assert.equal(validateProjectInput({ title: "My App", description: "A neat app" }), null);
  assert.ok(validateProjectInput({ title: "A" })); // too short
  assert.ok(validateProjectInput({ title: "Valid Title", githubUrl: "javascript:evil()" }));
  assert.ok(validateProjectInput({ title: "Valid Title", techStack: Array(15).fill("React") })); // max 10

  // Skills input validation
  assert.equal(validateSkillsInput([{ name: "React", category: "Frontend" }]), null);
  assert.ok(validateSkillsInput(Array(30).fill({ name: "Skill" }))); // max 25
  assert.ok(validateSkillsInput([{ name: "" }])); // empty name

  // Socials input validation
  assert.equal(validateSocialsInput({ github: "https://github.com/octocat" }), null);
  assert.ok(validateSocialsInput({ github: "javascript:alert(1)" }));

  // Project imageUrl safety & path traversal validation
  assert.equal(validateProjectInput({ title: "Media App", imageUrl: "/api/media/64f123abc.png" }), null);
  assert.equal(validateProjectInput({ title: "Versioned App", imageUrl: "/api/v1/media/64f123abc.png" }), null);
  assert.equal(validateProjectInput({ title: "Local Disk App", imageUrl: "/uploads/projects/project_123.webp" }), null);
  assert.equal(validateProjectInput({ title: "External App", imageUrl: "https://cdn.example.com/demo.webp" }), null);
  assert.ok(validateProjectInput({ title: "XSS App", imageUrl: "javascript:alert(1)" }));
  assert.ok(validateProjectInput({ title: "Traversal App", imageUrl: "/api/media/../../../etc/passwd" }));
  assert.ok(validateProjectInput({ title: "Avatar Hijack App", imageUrl: "/uploads/avatars/avatar_123.png" }));
  assert.ok(validateProjectInput({ title: "Poster Hijack App", imageUrl: "/uploads/posters/poster_123.png" }));

  // Public serialization respects privacy flags & masks owner fields by default
  const rawUser = {
    _id: "64f000000000000000000001",
    name: "Privacy Tester",
    email: "private@psit.ac.in",
    enrollmentNo: "2023CS001",
    role: "student",
    emailVerified: true,
    emailVerifiedAt: new Date("2026-08-15T00:00:00Z"),
    memberVerified: false,
    memberVerifiedAt: null,
    avatarUrl: "/api/media/avatar1.png",
    avatarPublicId: "secret-avatar-id",
    avatarProvider: "mongodb",
    bannerUrl: "/api/media/banner1.png",
    bannerPublicId: "secret-banner-id",
    bannerProvider: "mongodb",
    pendingProjectImages: [
      { url: "/api/media/pending1.png", publicId: "secret-pending-id", provider: "mongodb" },
    ],
    projects: [
      {
        _id: "64f000000000000000000002",
        title: "Hidden Proj",
        imageUrl: "/api/media/proj1.png",
        imagePublicId: "secret-proj-id",
        imageProvider: "mongodb",
      },
    ],
    privacy: { showEmail: false, showAttendance: false, showProjects: false },
  };
  for (const masked of [publicUser(rawUser), publicUser(rawUser, { isSelf: false })]) {
    assert.equal(masked.email, undefined);
    assert.equal(masked.enrollmentNo, undefined);
    assert.equal(masked.emailVerifiedAt, undefined);
    assert.equal(masked.memberVerifiedAt, undefined);
    assert.equal(masked.privacy, undefined);
    assert.equal(masked.pendingProjectImages, undefined);
    assert.equal(masked.avatarPublicId, undefined);
    assert.equal(masked.bannerPublicId, undefined);
    assert.deepEqual(masked.projects, []);
  }
  const selfView = publicUser(rawUser, { isSelf: true });
  assert.equal(selfView.email, "private@psit.ac.in");
  assert.equal(selfView.enrollmentNo, "2023CS001");
  assert.equal(selfView.projects.length, 1);
  assert.equal(selfView.projects[0].imagePublicId, undefined);
  assert.equal(selfView.projects[0].imageProvider, undefined);
  assert.equal(selfView.pendingProjectImages, undefined);
  assert.equal(selfView.avatarPublicId, undefined);
  assert.equal(selfView.bannerPublicId, undefined);
  assert.equal(selfView.privacy.showEmail, false);
  assert.equal(selfView.emailVerified, true);
  assert.equal(selfView.memberVerified, false);
});

test("executeDbFirstMediaClear enforces DB-first deletion and tolerates storage cleanup failure", async () => {
  let cleanupCalls = [];

  // 1. If DB clear throws, cleanup must NOT run (prevents broken dangling references)
  await assert.rejects(
    () =>
      executeDbFirstMediaClear({
        persistClear: async () => {
          throw new Error("Simulated DB write failure");
        },
        cleanupAsset: async (...args) => {
          cleanupCalls.push(args);
        },
      }),
    /Simulated DB write failure/
  );
  assert.equal(cleanupCalls.length, 0);

  // 2. If DB clear succeeds, cleanup failure is logged and does NOT fail the operation
  const res = await executeDbFirstMediaClear({
    persistClear: async () => ({ oldPublicId: "old-asset-1", oldProvider: "mongodb" }),
    cleanupAsset: async (id, provider) => {
      cleanupCalls.push([id, provider]);
      throw new Error("Simulated transient storage error");
    },
  });
  assert.deepEqual(cleanupCalls, [["old-asset-1", "mongodb"]]);
  assert.deepEqual(res, { oldPublicId: "old-asset-1", oldProvider: "mongodb" });

  // 3. No-op when nothing existed to clear
  cleanupCalls = [];
  const noop = await executeDbFirstMediaClear({
    persistClear: async () => null,
    cleanupAsset: async (...args) => {
      cleanupCalls.push(args);
    },
  });
  assert.equal(noop, null);
  assert.equal(cleanupCalls.length, 0);
});

test("Dynamic Identity Hub - End-to-End API Suite", async (t) => {
  const email = `hub-tester-${Date.now()}@psit.ac.in`;
  const password = "Password123";

  // 1. Signup & obtain session
  const signupRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Identity Tester",
      email,
      password,
      confirm: password,
      branch: "CSE",
      year: 3,
    }),
  });
  assert.equal(signupRes.status, 201);
  const cookie = signupRes.headers.get("set-cookie");
  assert.ok(cookie, "Session cookie must be set");

  const authHeaders = { Cookie: cookie };

  // 2. Fetch initial profile
  await t.test("GET /api/users/me returns default identity hub attributes", async () => {
    const res = await jsonFetch("/api/users/me", { headers: authHeaders });
    assert.equal(res.status, 200);
    assert.equal(res.data.name, "Identity Tester");
    assert.equal(res.data.headline, "");
    assert.equal(res.data.college, "PSIT Kanpur");
    assert.equal(res.data.bannerTheme, "google-brand");
    assert.equal(res.data.accentColor, "gblue");
    assert.equal(res.data.cardTheme, "default");
    assert.deepEqual(res.data.skills, []);
    assert.deepEqual(res.data.projects, []);
    assert.equal(res.data.privacy.showProjects, true);
  });

  // 3. Patch profile with enhanced metadata
  await t.test("PATCH /api/users/me updates headline, college, skills, appearance, and socials", async () => {
    const patchBody = {
      headline: "Full-Stack Engineer & Open Source Contributor",
      college: "Pranveer Singh Institute of Technology",
      specialization: "Cloud & Web Architectures",
      bannerTheme: "midnight-slate",
      accentColor: "ggreen",
      cardTheme: "dark",
      socials: {
        github: "https://github.com/gdgoc-tester",
        linkedin: "https://linkedin.com/in/gdgoc-tester",
        portfolio: "https://tester.dev",
        twitter: "https://x.com/gdgoc_tester",
      },
      skills: [
        { name: "TypeScript", category: "Programming" },
        { name: "React", category: "Frontend" },
        { name: "Node.js", category: "Backend" },
        { name: "MongoDB", category: "Databases" },
        { name: "Google Cloud", category: "Cloud & DevOps" },
      ],
      privacy: {
        showEmail: true,
        showAttendance: true,
        showProjects: true,
      },
    };

    const res = await jsonFetch("/api/users/me", {
      method: "PATCH",
      headers: authHeaders,
      body: patchBody,
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.headline, patchBody.headline);
    assert.equal(res.data.college, patchBody.college);
    assert.equal(res.data.specialization, patchBody.specialization);
    assert.equal(res.data.bannerTheme, "midnight-slate");
    assert.equal(res.data.accentColor, "ggreen");
    assert.equal(res.data.cardTheme, "dark");
    assert.equal(res.data.socials.github, "https://github.com/gdgoc-tester");
    assert.equal(res.data.skills.length, 5);
    assert.equal(res.data.privacy.showEmail, true);

    // Clearing a social link with empty string must persist
    const clearSocial = await jsonFetch("/api/users/me", {
      method: "PATCH",
      headers: authHeaders,
      body: { socials: { twitter: "" } },
    });
    assert.equal(clearSocial.status, 200);
    assert.equal(clearSocial.data.socials.twitter, "");
    assert.equal(clearSocial.data.socials.github, "https://github.com/gdgoc-tester");
  });

  // 4. Reject invalid options and mass-assignment tampering
  await t.test("PATCH /api/users/me rejects invalid themes and protects administrative fields", async () => {
    // Invalid theme
    const badTheme = await jsonFetch("/api/users/me", {
      method: "PATCH",
      headers: authHeaders,
      body: { bannerTheme: "neon-alien-slop" },
    });
    assert.equal(badTheme.status, 400);

    // Tampering attempt on role and member verification
    const tamper = await jsonFetch("/api/users/me", {
      method: "PATCH",
      headers: authHeaders,
      body: {
        role: "admin",
        memberVerified: true,
        tokenVersion: 999,
      },
    });
    assert.equal(tamper.status, 200);
    // Verified user fields remain un-tampered
    assert.equal(tamper.data.role, "student");
    assert.equal(tamper.data.memberVerified, false);
  });

  // 5. Featured Projects CRUD & Image Uploads
  let createdProjectId = null;
  let uploadedProjectImageUrl = null;

  await t.test("POST /api/users/me/projects/image validates format & size and returns retrievable URL", async () => {
    // Reject spoofed payload
    const badRes = await jsonFetch("/api/users/me/projects/image", {
      method: "POST",
      headers: authHeaders,
      body: { dataUrl: "data:image/png;base64," + Buffer.from("not-an-image").toString("base64") },
    });
    assert.equal(badRes.status, 400);

    // Accept valid 1x1 PNG
    const validPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const okRes = await jsonFetch("/api/users/me/projects/image", {
      method: "POST",
      headers: authHeaders,
      body: { dataUrl: validPng },
    });
    assert.equal(okRes.status, 201);
    assert.ok(okRes.data.url);
    uploadedProjectImageUrl = okRes.data.url;
  });

  await t.test("POST /api/users/me/projects adds a featured project", async () => {
    const projectPayload = {
      title: "GDGoC Campus Mobile App",
      description: "An open-source Flutter & Express application for event check-ins and campus networking.",
      techStack: ["Flutter", "Dart", "Node.js", "MongoDB"],
      githubUrl: "https://github.com/PSIT-GDGOC/campus-app",
      liveUrl: "https://app.psit-gdgoc.dev",
      imageUrl: uploadedProjectImageUrl,
      featured: true,
    };

    const res = await jsonFetch("/api/users/me/projects", {
      method: "POST",
      headers: authHeaders,
      body: projectPayload,
    });

    assert.equal(res.status, 201);
    assert.ok(res.data.project.id);
    assert.equal(res.data.project.title, projectPayload.title);
    assert.equal(res.data.project.imageUrl, uploadedProjectImageUrl);
    assert.deepEqual(res.data.project.techStack, projectPayload.techStack);
    assert.equal(res.data.user.projects.length, 1);
    createdProjectId = res.data.project.id;

    // Reject javascript: XSS imageUrl
    const xssRes = await jsonFetch("/api/users/me/projects", {
      method: "POST",
      headers: authHeaders,
      body: { title: "XSS Check", imageUrl: "javascript:alert(1)" },
    });
    assert.equal(xssRes.status, 400);
  });

  await t.test("PATCH /api/users/me/projects/:id updates existing project and handles invalid IDs", async () => {
    assert.ok(createdProjectId);
    const badIdRes = await jsonFetch("/api/users/me/projects/not-a-valid-id", {
      method: "PATCH",
      headers: authHeaders,
      body: { title: "Should 404" },
    });
    assert.equal(badIdRes.status, 404);

    const res = await jsonFetch(`/api/users/me/projects/${createdProjectId}`, {
      method: "PATCH",
      headers: authHeaders,
      body: {
        title: "GDGoC Campus Mobile Hub (v2)",
        techStack: ["React Native", "TypeScript", "Fastify"],
      },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.project.title, "GDGoC Campus Mobile Hub (v2)");
    assert.deepEqual(res.data.project.techStack, ["React Native", "TypeScript", "Fastify"]);
  });

  await t.test("POST /api/users/me/projects adds a second project and reorders them", async () => {
    const res2 = await jsonFetch("/api/users/me/projects", {
      method: "POST",
      headers: authHeaders,
      body: {
        title: "Autonomous AI Dev Bot",
        description: "Agentic coding companion with LLM tooling.",
        techStack: ["Python", "FastAPI", "Gemini API"],
      },
    });
    assert.equal(res2.status, 201);
    const id2 = res2.data.project.id;

    // Reorder so project 2 comes first
    const reorderRes = await jsonFetch("/api/users/me/projects/reorder", {
      method: "PUT",
      headers: authHeaders,
      body: { order: [id2, createdProjectId] },
    });
    assert.equal(reorderRes.status, 200);
    const projects = reorderRes.data.user.projects;
    assert.equal(projects[0].id, id2);
    assert.equal(projects[1].id, createdProjectId);

    // Verify order persists across fresh GET /api/users/me
    const refreshed = await jsonFetch("/api/users/me", { headers: authHeaders });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.data.projects[0].id, id2);
    assert.equal(refreshed.data.projects[1].id, createdProjectId);

    // Invalid reorder payloads must return 400 and leave order intact
    for (const invalidOrder of [
      [id2],
      [id2, id2],
      [id2, "000000000000000000000000"],
      [id2, createdProjectId, "000000000000000000000000"],
    ]) {
      const badReorder = await jsonFetch("/api/users/me/projects/reorder", {
        method: "PUT",
        headers: authHeaders,
        body: { order: invalidOrder },
      });
      assert.equal(badReorder.status, 400);
    }

    const stillOrdered = await jsonFetch("/api/users/me", { headers: authHeaders });
    assert.equal(stillOrdered.status, 200);
    assert.equal(stillOrdered.data.projects[0].id, id2);
    assert.equal(stillOrdered.data.projects[1].id, createdProjectId);
  });

  await t.test("DELETE /api/users/me/projects/:id removes a project", async () => {
    assert.ok(createdProjectId);
    const res = await jsonFetch(`/api/users/me/projects/${createdProjectId}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.user.projects.length, 1);
  });

  // 6. Cover Banner Upload & Removal
  await t.test("POST and DELETE /api/users/me/banner manages custom banners", async () => {
    // 1x1 transparent PNG data URL
    const pngBase64 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const uploadRes = await jsonFetch("/api/users/me/banner", {
      method: "POST",
      headers: authHeaders,
      body: { dataUrl: pngBase64 },
    });

    assert.equal(uploadRes.status, 200);
    assert.ok(uploadRes.data.user.bannerUrl);
    assert.equal(uploadRes.data.user.bannerTheme, "custom");

    // Remove banner
    const delRes = await jsonFetch("/api/users/me/banner", {
      method: "DELETE",
      headers: authHeaders,
    });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.user.bannerUrl, null);
    assert.equal(delRes.data.user.bannerTheme, "google-brand");
  });
});

test("Dynamic Identity Hub - Media Ownership, Orphan Cleanup & Concurrent Updates", async () => {
  const validPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const ts = Date.now();

  const signupA = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Media Owner A",
      email: `media-owner-a-${ts}@psit.ac.in`,
      password: "Password123",
      confirm: "Password123",
      branch: "CSE",
      year: 3,
    }),
  });
  assert.equal(signupA.status, 201);
  const headersA = { Cookie: signupA.headers.get("set-cookie") };

  const signupB = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Media Attacker B",
      email: `media-attacker-b-${ts}@psit.ac.in`,
      password: "Password123",
      confirm: "Password123",
      branch: "IT",
      year: 2,
    }),
  });
  assert.equal(signupB.status, 201);
  const headersB = { Cookie: signupB.headers.get("set-cookie") };

  // 1. User A uploads project image 1
  const img1Res = await jsonFetch("/api/users/me/projects/image", {
    method: "POST",
    headers: headersA,
    body: { dataUrl: validPng },
  });
  assert.equal(img1Res.status, 201);
  const img1Url = img1Res.data.url;
  assert.equal((await fetch(`${BASE_URL}${img1Url}`)).status, 200);

  // 2. User B must NOT be allowed to attach User A's project image via POST or PATCH
  const stealPost = await jsonFetch("/api/users/me/projects", {
    method: "POST",
    headers: headersB,
    body: { title: "Stolen Image Proj", imageUrl: img1Url },
  });
  assert.equal(stealPost.status, 403);

  const projB = await jsonFetch("/api/users/me/projects", {
    method: "POST",
    headers: headersB,
    body: { title: "User B Plain Proj" },
  });
  assert.equal(projB.status, 201);
  const userBProjId = projB.data.project.id;

  const stealPatch = await jsonFetch(`/api/users/me/projects/${userBProjId}`, {
    method: "PATCH",
    headers: headersB,
    body: { imageUrl: img1Url },
  });
  assert.equal(stealPatch.status, 403);

  // 3. User A attaches img1Url to two projects; deleting only one keeps shared asset alive
  const projA1 = await jsonFetch("/api/users/me/projects", {
    method: "POST",
    headers: headersA,
    body: { title: "Shared Image Proj 1", imageUrl: img1Url },
  });
  assert.equal(projA1.status, 201);
  const projA1Id = projA1.data.project.id;

  const projA2 = await jsonFetch("/api/users/me/projects", {
    method: "POST",
    headers: headersA,
    body: { title: "Shared Image Proj 2", imageUrl: img1Url },
  });
  assert.equal(projA2.status, 201);
  const projA2Id = projA2.data.project.id;

  // Cross-user reorder including User B's project ID must return 400
  const crossReorder = await jsonFetch("/api/users/me/projects/reorder", {
    method: "PUT",
    headers: headersA,
    body: { order: [projA1Id, userBProjId] },
  });
  assert.equal(crossReorder.status, 400);

  const delA1 = await jsonFetch(`/api/users/me/projects/${projA1Id}`, {
    method: "DELETE",
    headers: headersA,
  });
  assert.equal(delA1.status, 200);
  assert.equal((await fetch(`${BASE_URL}${img1Url}`)).status, 200, "Shared asset stays alive while Proj 2 uses it");

  // 4. Replacing Proj 2's image cleans up orphaned img1Url
  const img2Res = await jsonFetch("/api/users/me/projects/image", {
    method: "POST",
    headers: headersA,
    body: { dataUrl: validPng },
  });
  assert.equal(img2Res.status, 201);
  const img2Url = img2Res.data.url;

  const replaceImg = await jsonFetch(`/api/users/me/projects/${projA2Id}`, {
    method: "PATCH",
    headers: headersA,
    body: { imageUrl: img2Url },
  });
  assert.equal(replaceImg.status, 200);
  assert.equal((await fetch(`${BASE_URL}${img1Url}`)).status, 404, "Replaced image must be removed");
  assert.equal((await fetch(`${BASE_URL}${img2Url}`)).status, 200);

  // Deleting Proj 2 cleans up img2Url too
  const delA2 = await jsonFetch(`/api/users/me/projects/${projA2Id}`, {
    method: "DELETE",
    headers: headersA,
  });
  assert.equal(delA2.status, 200);
  assert.equal((await fetch(`${BASE_URL}${img2Url}`)).status, 404, "Deleted project image must be removed");

  // 5. Concurrent avatar replacements & double deletion stay consistent
  const avInit = await jsonFetch("/api/users/me/avatar", {
    method: "POST",
    headers: headersA,
    body: { dataUrl: validPng },
  });
  assert.equal(avInit.status, 200);
  const initialAvatarUrl = avInit.data.user.avatarUrl;

  const [r1, r2] = await Promise.all([
    jsonFetch("/api/users/me/avatar", { method: "POST", headers: headersA, body: { dataUrl: validPng } }),
    jsonFetch("/api/users/me/avatar", { method: "POST", headers: headersA, body: { dataUrl: validPng } }),
  ]);
  assert.equal(r1.status, 200);
  assert.equal(r2.status, 200);
  assert.equal((await fetch(`${BASE_URL}${initialAvatarUrl}`)).status, 404);

  const meAfterRace = await jsonFetch("/api/users/me", { headers: headersA });
  assert.equal(meAfterRace.status, 200);
  const activeAvatarUrl = meAfterRace.data.avatarUrl;
  assert.ok(activeAvatarUrl);
  assert.equal((await fetch(`${BASE_URL}${activeAvatarUrl}`)).status, 200, "Active avatar must remain retrievable");

  const [d1, d2] = await Promise.all([
    jsonFetch("/api/users/me/avatar", { method: "DELETE", headers: headersA }),
    jsonFetch("/api/users/me/avatar", { method: "DELETE", headers: headersA }),
  ]);
  const delStatuses = [d1.status, d2.status].sort((a, b) => a - b);
  assert.deepEqual(delStatuses, [200, 400]);

  const meCleared = await jsonFetch("/api/users/me", { headers: headersA });
  assert.equal(meCleared.data.avatarUrl, null);
  assert.equal((await fetch(`${BASE_URL}${activeAvatarUrl}`)).status, 404);
});
