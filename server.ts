import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Mock Logic ---
  // In a real app, this would connect to a DB using the schema.sql
  
  const mockMaterials = [
    { id: '1', name: 'Melamina Blanca 18mm', base_material: 'Aglomerado', finish_type: 'Melamina', price_per_m2: 15000 },
    { id: '2', name: 'MDF Crudo 18mm', base_material: 'MDF', finish_type: 'Folio', price_per_m2: 12000 },
    { id: '3', name: 'Laqueado Premium', base_material: 'MDF', finish_type: 'Laqueado', price_per_m2: 45000 },
    { id: '4', name: 'Enchapado Roble', base_material: 'MDF', finish_type: 'Enchapado', price_per_m2: 55000 },
  ];

  app.get("/api/materials", (req, res) => {
    res.json(mockMaterials);
  });

  app.post("/api/validate-material", (req, res) => {
    const { base_material, finish_type } = req.body;
    
    // Regla: Si el frente es laqueado/enchapado, el material base debe ser MDF.
    const isPremiumFinish = ['Laqueado', 'Enchapado'].includes(finish_type);
    const isMDF = base_material === 'MDF';

    if (isPremiumFinish && !isMDF) {
      return res.status(400).json({ 
        valid: false, 
        error: "Regla de Calidad: Los acabados Laqueados o Enchapados requieren obligatoriamente una base de MDF para garantizar la estabilidad y el acabado." 
      });
    }

    res.json({ valid: true });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
