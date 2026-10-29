const AdmZip = require("adm-zip");
function fixture(file) {
  const z = new AdmZip();
  const statements = [
    "Energy is conserved in an isolated system.",
    "Velocity has both magnitude and direction.",
    "A force can change the motion of an object.",
    "Friction opposes relative motion between surfaces.",
    "Mass measures the amount of matter in an object.",
    "Acceleration is the rate of change of velocity.",
    "Momentum is the product of mass and velocity.",
    "Gravity attracts objects that have mass.",
  ];
  z.addFile(
    "ppt/presentation.xml",
    Buffer.from(
      `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${statements.map((_, i) => `<p:sldId id="${256 + i}" r:id="r${i}"/>`).join("")}</p:sldIdLst></p:presentation>`,
    ),
  );
  z.addFile(
    "ppt/_rels/presentation.xml.rels",
    Buffer.from(
      `<Relationships>${statements.map((_, i) => `<Relationship Id="r${i}" Type="slide" Target="slides/slide${i + 1}.xml"/>`).join("")}</Relationships>`,
    ),
  );
  statements.forEach((s, i) =>
    z.addFile(
      `ppt/slides/slide${i + 1}.xml`,
      Buffer.from(
        `<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${s}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
      ),
    ),
  );
  z.writeZip(file);
  return file;
}
module.exports = fixture;
