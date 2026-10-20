import { Router } from "express";
import Project from "../models/Project.js";

const router = Router();

// GET /api/projects - Public list of published projects
router.get("/", async (req, res) => {
  try {
    const { domain, search } = req.query;
    const query = { publicationStatus: "published" };

    if (domain) {
      query.$or = [{ domain }, { category: domain }];
    }

    if (search) {
      const searchRegex = new RegExp(String(search).trim(), "i");
      query.$or = [
        { title: searchRegex },
        { shortDescription: searchRegex },
        { techStack: searchRegex },
      ];
    }

    const projects = await Project.find(query).sort({ createdAt: -1 });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ message: "Failed to load projects." });
  }
});

// GET /api/projects/:id - Public project detail
router.get("/:id", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      publicationStatus: "published",
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    res.json(project);
  } catch {
    res.status(404).json({ message: "Project not found." });
  }
});

export default router;

