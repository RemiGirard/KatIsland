/* ============================================================
   GRIFFES & PLUMES — sprites-index.js (9/9, dernier)
   Assemble window.Sprites depuis toute la famille sprites-*.js.
   ============================================================ */
"use strict";


  // ------------------------------------------------------------
  // Namespace public
  // ------------------------------------------------------------
  window.Sprites = {
    FRAMES,
    UNIT_DIRS,
    dirForAngle,
    __bakeQLen: function () { return bakeQ.length; },   // debug : file de génération d'arrière-plan
    __pump: function (ms) { pumpSlice(ms || 50); return bakeQ.length; }, // debug : force un lot de travail
    getUnitFrames,
    getUnitIcon,
    getSoulCanvas,
    getMannequinCanvas,
    getWeaponCanvas,
    getRangedCanvas,
    getStaffCanvas,
    getOrdnanceCanvas,
    getBladeCanvas,
    getArmorIcon,
    getRobeIcon,
    getVestIcon,
    getSuitIcon,
    getShieldIcon,
    getNodeCanvas,
    getObstacleCanvas,
    getNodeRef,
    getObstacleRef,
    getTerrainRef,
    getDecorRef,
    getBossCanvas,
    getBossMinion,
    getNestCanvas,
    getActivityIcon,
    getEmblem,
    getFactionBanner,
    drawMascot,
  };
