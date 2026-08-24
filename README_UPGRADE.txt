LUNAREG INTERACTIVE UPGRADE v2.1 - BUILD HOTFIX INCLUDED
========================================================

HOW TO INSTALL
1. Extract this ZIP directly into the existing LunaReg project root.
   This is the folder that contains package.json.
2. Allow files to overwrite when Windows asks.
3. Run:
      powershell -ExecutionPolicy Bypass -File .\upgrade.ps1
   or double-click RUN-UPGRADE.cmd.
4. The script will:
   - preserve any old v2.0 backup folders by moving them OUTSIDE the Next.js project,
   - create a new timestamped backup one folder above the project,
   - apply the upgraded app files,
   - REMOVE the temporary _lunareg_upgrade TS/TSX staging folder before Next.js type-checking,
   - clear .next,
   - run npm run build.
5. When the build succeeds, run:
      npm run dev
6. Open http://localhost:3000

WHY v2.1 EXISTS
The previous installer left _lunareg_upgrade and .lunareg-backup-* folders inside
the Next.js project. Since this project's tsconfig includes **/*.ts and **/*.tsx,
Next.js type-checked those temporary/backup copies too. This caused a false
"Cannot find module './LunarScene'" error from the staging copy of LunaRegApp.tsx.

v2.1 removes staging files before the build and keeps backups outside the source
tree, so only the actual application code is compiled.

REAL LUNAR IMAGES
See IMAGE_SETUP.txt. The UI works without them and falls back to the built-in
lunar visualization.
