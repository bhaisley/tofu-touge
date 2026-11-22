# Haruna after rain

The route is a fictional Gunma mountain pass at daybreak. The sun sits low over a clearing valley. Cedar canopy, road cuts and the open switchbacks each receive different light. The title uses a separate automotive illustration. All driving footage comes from the playable Three.js scene.

## Scanned surfaces

The ground materials use Poly Haven scans at several scales. The asphalt, stone, and forest floor combine albedo, roughness and OpenGL normals. The normal’s X and Y components share a texture with roughness. Reconstructing Z in the material saves memory. [Poly Haven CC0 license](https://polyhaven.com/license)

- The asphalt aggregate comes from Sergej Majboroda and Jenelle van Heerden. Water, worn paint, wheel tracks and drainage patterns are added in road coordinates. [Asphalt 04](https://polyhaven.com/a/asphalt_04)
- The verges use gravel by Charlotte Baglioni, loose stones, and a transition into the surrounding leaf bed. [Gravel Floor 03](https://polyhaven.com/a/gravel_floor_03)
- Exposed verges and meadow slopes blend Charlotte Baglioni’s close grass scan with the broader color variation in Rob Tuytel’s grassland scan. Canopy cover brings leaf litter through beneath the trees. Susuki seed heads are characteristic of the autumn grassland on Mount Haruna. [Leafy Grass](https://polyhaven.com/a/leafy_grass) · [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) · [Gunma Prefecture’s Haruna Park guide](https://www.pref.gunma.jp/page/1189.html)
- The soil and leaf litter use forest ground by Rob Tuytel. Tree cover shades the soil across the hillside. [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01)
- The eleven retaining walls use mossy masonry by Amal Kumar, with coping, local dampness and drainage outlets modeled along the road. [Mossy Stone Wall](https://polyhaven.com/a/mossy_stone_wall)
- Exposed stone on the cut banks uses a rock face photographed by Dario Barresi and processed by Rico Cilliers. [Rock Face 03](https://polyhaven.com/a/rock_face_03)

## Original scenery

ImageGen supplied the distant panorama, title artwork, tree and branch cutouts, groundcover, bark and roadside material studies. The panorama wraps around the scene and supplies its ambient lighting. The pass, GR86 and roadside structures are modeled in Three.js.

Near the road, sugi, red pine and deciduous trees have modeled trunks and branches, layered leaves and root contacts. Ferns, dwarf bamboo and shrubs fill the banks between mature trees. Galvanized barriers, concrete utility poles, convex traffic mirrors, tile eaves, the shrine approach and the tofu shop provide close-range detail. The shop has a lit interior behind its windows.

The near verge combines short, folded blades and dry thatch with sedge and silvergrass clumps. The same cover value controls the ground texture and plant placement, so grass recedes together with its green base under dense tree crowns. Aerial meadow detail gives the hillside its larger patches of green and straw. [Grass albedo](dist/assets/art/haruna-grass.webp) · [Grass surface detail](dist/assets/art/haruna-grass-surface.webp) · [Meadow variation](dist/assets/art/haruna-meadow.webp)

## GR86 rear bodywork

The Tokyo Auto Salon photographs guided the conversion’s raised lamps, cast wheels, glossy overfenders and black-and-white rocker stripe. The five later GR86 rear views guided the shark fin, roof shoulders, ducktail, lamp shapes and bumper. The spoiler rises toward the center and has a working stop lamp just under its lip. A polished black strip joins the outboard C-shaped lights. The plate sits in a pressed recess below the trunk. The lacquered black valance runs from both rear wheel arches around the bumper, with the same pearl accent and upper black stripe as the sides. A textured diffuser surrounds the two rolled exhaust tips. [Result Japan NEO86 gallery](https://www.evasivemotorsports.com/store/product/result-japan-neo86-wide-body-kit-frp-scion-fr-s-subaru-brz-toyota-86-13-20/) · [Toyota GR86 exterior photographs](https://media.toyota.co.uk/images/gr86-exterior-static-2022-current/)

The loose-glass photograph supplied the rounded corners, ceramic border and heater pattern. The installed-glass photographs set the final shape on the car. The 1.42 m lower edge sweeps aft and appears nearly level in a straight rear view. Its corners turn into the painted pillars, leaving a broad strip of trunk visible from chase height. A dotted inner edge follows the black ceramic border, and sixteen fine copper heater lines curve between the side busbars. [In-game rear comparison](playtest/gr86-rear-and-paint.jpg)

Both faces of the rear glass contribute to its reflection. The absorption increases at shallow viewing angles. The shelf, seatbacks, cabin brace and mirror remain visible through the clear area. The main hoop sits behind both seats and its diagonal passes 74 mm behind the driver's headrest. The black NEO86 exhibition plate appears in View Car. The delivery car carries the Gunma registration.

## Reflections and shadows

Puddles use a local reflection camera aligned to the grade and bank of the car’s current stretch of road. Exposed aggregate, wheel paths and pooled water have different roughness. Each rear tire samples this water to determine how much spray it throws. The convex mirrors capture the road from their own positions when close enough to read. A directional sunlight shadow follows the car and the next bend, with the shadow map snapped to whole texels to keep fine shadows stable.

The GR86 samples two neighboring environment captures as it moves. There are 95 capture stations about 34 metres apart. Each one supplies broad directional light as well as sharper reflections from the forest, mountains, sky and roadside geometry. The pearl panels and graphite overfenders have a smooth clearcoat over a softer base. Their reflected sky openings have enough brightness to trace the doors and rear deck under the canopy. In the walkaround, a six-sided capture at window height lets tree trunks and the horizon travel across the clearcoat and curved glass as the player orbits the car. The car is hidden during each capture.

Short-range ambient occlusion comes from the finished car geometry. The bake traces 64 rays per sampled vertex and packs the geometry records into a lossless texture. Separate wheel, brake and body assemblies keep the fixed caliper and rotating spokes correctly shaded. The shader applies the result to indirect light. The driver’s-door lettering, registrations, GR86 badge face and small body decals share a lossless atlas so their glyphs are consistent across devices. [Occlusion bake](dist/assets/art/neo86-occlusion.webp) · [GR86 livery markings](dist/assets/art/neo86-markings.webp)

After changing the environment, serve the editable game, install Playwright with Chromium in your development environment, and run the following commands from the game directory. An installed Chromium browser can be selected with the optional `CHROME_BIN` environment variable.

```sh
node tools/bake-reflections.cjs http://127.0.0.1:8477/
python3 tools/standalone.py
```

After editing the car geometry, run `node tools/bake-car-occlusion.cjs http://127.0.0.1:8477/` before packing the HTML. Run `node tools/bake-car-markings.cjs` after editing the printed artwork. The two bakers use Sharp to write lossless WebP files. When an assembly changes, the game uses neutral shading for that assembly until its bake is refreshed.

## ImageGen prompt record

The built-in ImageGen tool produced the following source art. Each entry links to the optimized game assets.

<details>
<summary>haruna-sky.webp</summary>

> Use case: photorealistic natural landscape. A texture asset for a Japanese mountain-pass driving simulator. Create a very wide 3:1 ultra-detailed photographic panoramic band of the forested mountains of Gunma Prefecture from a shoulder of Mount Haruna, as wet weather clears shortly after sunrise in early autumn. Continuous 360-degree sweep intended for a cylindrical panorama. Broad, rounded, cedar-covered Japanese ridgelines with their fine forest texture, alternating layers of wooded valleys and low morning mist; realistically low profile mountains, far ridgelines spread across the entire image. Sky occupies the upper 53 percent, with the mountain crests varying gently around that level. Natural cool silver-blue sky, separate bands of textured broken stratocumulus, soft directional champagne-gold sunlight close to the horizon centred roughly seventy percent along image width, delicate warm rim on one layer of cloud, cool desaturated slate and teal-green valleys, believable atmospheric perspective. Upper sky remains calm. Photograph captured with a professional level panoramic head; subtle filmic highlight rolloff, exceptional mountain detail and realistic dynamic range, natural neutral color grading. The left and right edges meet at the same distant ridge height and similar sky color so it can wrap. No roadway, no foreground objects, no big trees, no architecture, no car, no humans, no text or UI, no poster or illustration. Full bleed photographic landscape only.

[haruna-sky.webp](dist/assets/art/haruna-sky.webp)

</details>

<details>
<summary>haruna-dawn.webp</summary>

> Use case: photorealistic editorial automotive cover art for Tofu Touge. Edit the first supplied image, retaining its 16:9 camera composition and the Japanese mountain hairpin with wet asphalt, sugi, guardrails and pale dawn mist. Replace the vintage car completely with a MODERN second-generation Toyota GR86 2-door fastback coupe wearing a custom Result Japan NEO86 panda wide-body kit. The other three images show the kit to study closely. Faithfully follow the broad low wedge nose, two individually raised compact rectangular glass pop-up headlight pods with white angular roofs and warm lamps, two lower rectangular yellow fog lights in dark recesses either side of the central radiator, the thin horizontal white stripe through the thick dark bumper, sculpted white bonnet, deep black front splitter. The car behind this retro nose has the curving roof, long frameless door, short trunk and rear quarter window of a current GR86 sports coupe, NOT an AE86 hatchback. Smooth porcelain white clearcoat, satin charcoal bolt-on overfenders, two-tone door and skirts, body color door mirrors, eight thick rounded dark gunmetal Watanabe competition spokes with tiny red center caps, low profile tires. Restrained small warm-white Japanese door lettering on the black lower side skirt reads 藤原とうふ店（自家用）. Modern rear ducktail, understated. Car driving across a wet hairpin, front-three-quarter side view from driver eye height; nose points to the lower LEFT and the side and wheel arches visible to the RIGHT. Clean lively realistic reflections with breaks from the road texture and very fine tire spray. Car fully inside frame, its center around x=.69,y=.65; front tip around .38 or .40 width, back approaching .94 width. Keep the left third predominantly dark natural forestry or shadow for overlay UI, and space at top and bottom. Intense yet believable full-frame automotive photography, restrained forest greens, warm headlight against silver morning, 45mm lens, real glass, stunning close detail. No appended text, graphics, logos, watermark, titles, HUD, frames or collage. The supplied product photos are styling references; make a single new mountain scene.

[haruna-dawn.webp](dist/assets/art/haruna-dawn.webp)

</details>

<details>
<summary>haruna-trees.webp</summary>

> Use case: photorealistic-natural. Production alpha-cutout tree texture atlas for a true-to-life Japanese mountain racing game, like clean botanical photographs on transparent film. Wide 3:1 rectangular contact sheet of exactly FOUR individual complete trees in four equally wide side by side columns. Each tree fully within its own column with generous transparent gutters. All four same image height, tree tip near 4%, trunk bottom near 96%, root trunk centered. FIRST: mature Japanese sugi cryptomeria, long straight reddish deeply fluted trunk exposed to 40 percent of height, narrow drooping, feathery dark cedar boughs stepped naturally along upper crown. SECOND: wild Japanese red pine, weathered gray-red trunk, asymmetrical leaning open branching with irregular clusters of dark needles, high broken crown, not a manicured bonsai. THIRD: natural Japanese mountain beech in rich olive summer green with slender gray trunk forked and irregular little clusters, airy ragged leaf silhouette and many tiny see-through gaps. FOURTH: Japanese mountain maple with irregular layered foliage, mostly muted olive-green with only a few bronze or russet tips. A botanical photogrammetry capture of real mature trees in Gunma, photographic microtexture, tiny pine needles and visible twig detail, neutral stone-gray morning light with a subtle warm upper-right edge and soft natural shadow. Natural subdued colors, human-scale foliage, physically plausible highlights, rich tones, absolutely no illustration, no painterly marks, no glowing edges. True transparent alpha background and holes between branches. Only the upright individual trees, no ground, no shadows around them, no labels, no objects, no borders.

[haruna-trees.webp](dist/assets/art/haruna-trees.webp)

</details>

<details>
<summary>haruna-understory.webp</summary>

> Use case: photorealistic-natural. Technical RGBA foliage cutout atlas, square 2 by 2 grid, each of FOUR cells contains one individual forest plant or bough cutout, separated by wide transparent gutters. All cutouts complete and centered horizontally with the stem root at the bottom center of its own cell. Upper left: ONE horizontal fan of real Japanese cedar cryptomeria sprays on a woody limb, a rich fan of airy needle fronds growing from a SINGLE exposed cut stem at lower center, radiating UP AND OUT; intricate tapered drooping green tips. Upper right: ONE real Japanese woodland fern, fountain shaped with five to nine arching fronds and individually legible paired leaflets, lower root center. Lower left: a loose individual Japanese sasa bamboo grass tussock with thin bent brown stems, pointed elongated tin green and olive leaves, natural insect nicks; lower root center. Lower right: one natural tuft of fine sedge and wild grass with dew-dark green blades and a few straw-yellow dry stems, lower root center. Crisp photoreal field botany specimen photography at high detail. Filmic soft overcast morning exposure, muted deep jade, forest olive, sage, physically natural foliage rather than saturated green. Preserve open lacy holes between leaves as real transparency. True clear alpha background, no ground, no shadows on a backing, no writing or diagrams, no labels, no grid lines, no surrounding scenery, no black fringe, no rendering or painting. Fully contained without clipping.

[haruna-understory.webp](dist/assets/art/haruna-understory.webp)

</details>

<details>
<summary>haruna-boughs.webp</summary>

> Use case: photorealistic-natural. A high resolution texture atlas of real photographs of tree branches on a genuinely transparent alpha background, orthographic botanical field photography for a mountain forest game. Compose a square grid of EXACTLY four equal cells with generous gutters, one isolated bough per cell. All four branches have their cut woody stem centered on the very bottom of their own cell, spreading out and up into a broad asymmetric fan, all plant tips fully contained with transparent margin. TOP LEFT: Japanese red pine branch tip with reddish-gray gnarled twig, intricate dense green tufts of long sharply legible pine needles with open sky gaps. TOP RIGHT: Japanese beech forked slender branch bearing many small green oval leaves with delicate toothed margins, three clear leaf masses with open negative spaces, glossy varied olive leaves and a few twigs. BOTTOM LEFT: Japanese mountain maple bough, clearly palmate pointed small Japanese maple leaves on reddish twigs, mostly muted olive with restrained reddish copper on a few tips, four irregular sprays and gaps. BOTTOM RIGHT: a second dense juvenile Japanese cedar branchlet spray with foliage angled up and out from lower middle, split into three distinct feathery triangular little boughs. Forest-green real diffuse color microtexture, neutral overcast soft morning light from above with soft warm highlights on upper surfaces. Incredible realism of actual botanical specimens, subdued deep natural color, visible branches and needles, no painted or graphical shapes. Transparent among all the leaves and along needle silhouettes. No floor or cast shadow, no labels or grid lines, no decoration, no surrounding plants or landscape. This is not an image of full trees, each cell is a single branch.

[haruna-boughs.webp](dist/assets/art/haruna-boughs.webp)

</details>

<details>
<summary>haruna-bark.webp</summary>

> Use case: photorealistic-natural. Production bark ALBEDO material atlas for forest trunks in a realistic Japanese driving videogame. Wide landscape 2:1 image. Four exactly equal, vertical, full-height edge-to-edge texture panels, absolutely no separators, writing, margins, horizontal panels, or shadows between panels. In each panel the bark fills 100% of view like a flat close-up orthographic macro photograph of about 35 cm across by 70 cm high, no visible trunk outlines, no perspective and no ground. Far left panel genuine Japanese cedar cryptomeria bark with vertical interweaving narrow reddish gray fibrous strips and fissures. Second panel authentic Japanese red pine trunk with irregularly flaked orange-gray brown plates. Third soft warm-gray Japanese beech trunk with quiet fine lenticels, small scars, mottling and light silver dusty lichen, muted and fairly smooth. Fourth panel Japanese maple olive-gray bark, mostly smooth with shallow narrow broken vertical fissures and muted spotting. Soft neutral diffuse cross-polarized light, photogrammetry PBR scan color, muted naturally damp surfaces, restrained medium natural albedo, no direct or side lighting and no highlights. Tile each individual texture seamlessly top to bottom. No leaves, mushrooms, twigs, signs, gravel or any embellishment. Do not make a poster. Four precise equally wide, flat photographic bark samples only.

[haruna-bark.webp](dist/assets/art/haruna-bark.webp)

</details>

<details>
<summary>haruna-thickets.webp</summary>

> A true alpha transparent 2 by 2 vegetation atlas for a photoreal Japanese mountain forest driving simulation, artwork only. Cross-polarized botanical field photography, difficult to distinguish from real field photography. Four dense naturally grown freestanding groundcover clumps, all from Mount Haruna early autumn. Four quadrants each contain a SINGLE intact asymmetric broad clump. Each stands on the same invisible ground plane, its roots ending at the bottom center of its quadrant, all plant tips and side leaves within the cell, transparent pixels between silhouettes, no floating fragments, no ground, no sky, no horizon, no black backing or cast shadow. Upper left: a thick island of sasa veitchii dwarf bamboo, many distinct arching sprays rising from rhizomes close to the ground, a dense overlapping thicket of grassy lanceolate blades, broad flattened mound, individual leaves small by comparison to the overall plant. Upper right: a low Japanese azalea boundary shrub, spreading slender interwoven brown stems, softly rounded crown, tight small dark olive leaves, a handful of bronzed autumn leaves, no flowers. Lower left: a massed colony of mountain woodland ferns with many slender divided arching fronds of varying heights, some old copper fronds at the base, natural irregular rim like a patch in the real woods. Lower right: a wild mixed forest-edge hassaku-like evergreen shrub and fine broadleaf saplings with slightly taller sparse shoots emerging from a dark leafy base, moist slate-olive mixed foliage. All four clumps as seen from a driver from nearly horizontal perspective, slight upward view onto the leaf-bearing stems. Soft clouded sky diffuse neutral illumination from upper left. Restrained olive greens and dark cool green in the understory with natural warm-gray twigs, clean alpha along fine edges, crisp individual leaves, no bright lime green, no whitespace between components of a clump, complete silhouettes. No stylization, text, symbols, labels, grids, boxes, diagram, ground shadows or background. Equal square cells with generous margin, each plant wider than tall, occupies 84 percent of its slot horizontally.

[haruna-thickets.webp](dist/assets/art/haruna-thickets.webp)

</details>

<details>
<summary>haruna-grasses.webp</summary>

> Use case: photorealistic-natural. Make a square game-ready botanical photograph atlas of four individual clumps of wild grasses from an early autumn Japanese mountain road. Genuine transparent background with crisp antialiased cutout, including all negative spaces between separate leaves. Four independent photographs centered in four equally sized quadrants, a strict 2 by 2 layout, with an empty gutter down the exact middle of both axes. Each plant has its own ground contact exactly 94 percent down its quadrant, at the horizontal center of its own quadrant. Use 90% of the available width and about 83% of the available height in each cell, separately framed. Top left: low spreading tussock of many soft dark-green and olive wiry blades, flopping irregularly left and right, mixed tiny clover-like leaves and some straw blades in the thatch, realistic close-mown roadside grass growing in a band. Top right: coarse arched native Japanese sedge with narrow long olive-green leaves and pale central veins, green lower down and warm, a few straw ends, clear tapered tips. Bottom left: a young clump of Japanese susuki, Miscanthus sinensis, very fine yellow-green leaves bending outwards with a scattering of three graceful, pale copper-silver feathery seed panicles on its tallest slender stems. Bottom right: a mature irregular stand of early-autumn susuki with five airy silk plumose heads, subtler warm tan and silver blades. Photographed from directly to the side exactly at plant level. Earthy neutral outdoor photographic light with fresh dark greens near the roots and subtle light filtering through the translucent blades. Frayed thatch at the very bottom of each clump, no visible earth strips or roots, no hard dark outline, no clip at the border, no backplate, no cast shadow, no pot, scenery, labels, framing lines, lettering, or uniform garden arrangement. The planted grasses look as they would growing in a mountain meadow.

[Grass atlas](dist/assets/art/haruna-grasses.webp)

</details>

<details>
<summary>haruna-trees-alt.webp</summary>

> Create a photogrammetry-quality vegetation cutout atlas for a photorealistic Japanese mountain pass game. One extra-wide landscape frame, precisely FOUR equal-width columns in ONE horizontal row, each column has one separate entire fully realistic mature native Japanese tree from ground contact to crown tip. Strict true alpha transparency all around and between foliage, including realistic negative spaces between branches and at the trunks. Absolutely no haze or solid background, ground plane, labels, ground shadow, horizon, cast shadows onto empty space, grids or lines. All four specimens viewed from road level with orthographic long lens, the whole needle/leaf crown fills 85–92 percent of its column height; all off-centre limbs within their own cell; small ground contacts near the SAME bottom baseline at 98 percent height, each foot near its own column center. Strong deep round foliage volume, irregular airy edges, many fine branch tips. Natural soft neutral daylight filtered through a thin cloud, avoid dramatic directional shade and hard highlights. From left: (1) mature wild cryptomeria japonica with a slender warm fibrous red-brown upright trunk, largely clean bare lower quarter, compact high spire and asymmetric, tufted, slightly wind-pruned cedar canopy, dense many fine scaly needles, natural olive-slate green; (2) tall mountain akamatsu Japanese red pine, almost upright slender reddish orange trunk with aging gray bark at base, lightly forked crown with two asymmetric horizontally spreading upper limbs, open airborne small flat sparrow-nest-like needle clusters at different heights, a whole living pine growing in a woodland stand, not an ornamental bonsai; (3) mature Japanese beech, graceful pale gray straight main stem which splits into slender meandering high limbs beneath an airy softly irregular oval umbrella crown, tiny muted forest-green beech leaves with just a little early yellowing; (4) young-mature Japanese mountain maple, moss-stained fine forked brown bark, an irregular wide spreading dome of delicate small 7-lobed leaves, slightly mottled flame-copper, ochre and muted olive hues, colorful autumn on some tips only. Real separate photographic objects for compositing into a movie, scientifically plausible species, optical detail down to leaf clusters and bark, no flowers, no roots extending horizontally, no ornamental equipment, no artificial uniform branches. Wider and shorter frame with four tall specimens, natural heights individually fitted by adjusted viewing distance.

[haruna-trees-alt.webp](dist/assets/art/haruna-trees-alt.webp)

</details>

<details>
<summary>roadside-zinc.webp, roadside-concrete.webp, roadside-cedar.webp, roadside-ceramic.webp</summary>

> Use case: photorealistic-natural. Asset type: physically based game texture reference sheet. Create a square, perfectly aligned 2 by 2 atlas of FOUR different seamless material macro photographs, each filling precisely one equal quadrant without gutters, labels, seams between panels, or perspective. Each flat material fills the entire quadrant to all four edges. Orthographic scanner photographs under cross-polarized even diffuse white light. Upper LEFT: weathered hot-dip galvanized roadside guardrail sheet metal viewed perfectly flat, muted light neutral silver with delicate irregular crystalline zinc mottling, a few very fine hairline scratches, soft darker salt weathering, a faint oxidized fleck. No shape, no beam ridges, no screws or holes. Upper RIGHT: medium gray Japanese roadside cast precast concrete, tiny dark basalt grains and small airy pores, slight water wear and lichen dust. No grooves, text, visible cement blocks or large cracks. Lower LEFT: close photograph of old Japanese sugi cedar timber, vertical tight grain running from bottom to top, warm desaturated grey-brown, fine black crevices from age, realistic fibrous weathering, one restrained small knot, no distinct boards or boundary joints. Lower RIGHT: natural dark charcoal ceramic Japanese roof tile surface, gently varying iron-gray and old black ceramic glaze patina, fine gritty flecks and a hint of mossy dust; a single planar material with no tile boundary lines or relief shapes. Each square is its own soft, even, repeatable photogrammetry base color sample without specular glints, directional shadows, beveled frames, decoration or dividers. Ultra sharp fine scale, calibrated neutral color gamut, 2048x2048.

[roadside-zinc.webp](dist/assets/art/roadside-zinc.webp) · [roadside-concrete.webp](dist/assets/art/roadside-concrete.webp) · [roadside-cedar.webp](dist/assets/art/roadside-cedar.webp) · [roadside-ceramic.webp](dist/assets/art/roadside-ceramic.webp)

</details>

<details>
<summary>tofu-workshop.webp</summary>

> Use case: photorealistic-natural. Asset type: unique realistic shop interior environment texture, extra-wide approximately 3:1 panorama. Document a small traditional Japanese tofu workshop at dawn, seen straight on from the street with the entire front facade and its glass/windows completely removed. Eye-level orthogonal view inside, at middle of workplace, like a well exposed cinematic architecture photograph. Aged cream plaster walls and off-white wall tiles, steel tofu warming vats and wooden square tofu molds, metal wire trays, neat stacked shallow cream delivery tubs at the left, wooden workcounter and prep tools through the middle, dark timber beams above and in the background, a single old fluorescent fixture, shelves extending into a dim back room to the right. Early-morning warm-white working lights over a subdued interior, softly lit warm white-to-neutral surfaces, visible shadow depth, brighter on the left, darker right corner. Physically accurate, naturally weathered surfaces, photographic detail, simple authentic rural 1980s-90s shop; leave the floor and some of the ceiling visible. Fill the frame edge to edge with INSIDE the room. No people, no readable letters, no logos, no border, no facade, no front wall, no front windowframes or exterior shutters, no curtain, no heavy glass reflections or colored neon. We will put true 3D frames and glass in front in the game.

[tofu-workshop.webp](dist/assets/art/tofu-workshop.webp)

</details>

<details>
<summary>roadside-vending.webp</summary>

> Use case: product-mockup. Asset type: front-face photograph texture, edge to edge tall portrait, 1:2 width to height, for the refrigerated drink vending machine outside a rural Japanese tofu shop in a realistic driving game. An absolutely straight-on orthographic photograph looking level at the flat front face of a beautifully detailed worn brick-red 1990s Japanese beverage vending machine. Camera is perfectly perpendicular to its face, no perspective skew, no side visible. Machine fills 100% of the frame edge to edge, full rectangular front face and minimal margins, no environment. Top ~58% crisp illuminated display of three rows of realistic tiny cans and PET bottles, bottle caps, soft product colors, small price tags and individual round buttons in a precise grid. Lower right payment panel with coin slot, small display and coin-return lever; at bottom a wide dark recessed dispensing flap and metal intake grille. Subtle sticker edges, faded paint, fine scratch and rain speckle on enamel. Warm-white cabinet lighting, naturally muted realistic colors, honest photographic material definition, moderate dynamic range for use as a texture. Invented product labels with small Japanese detail, no identifiable brands or large lettering. No floor, shadow outside the machine, scenery, upper marquee protrusion, decorative border, framing, captions or watermark.

[roadside-vending.webp](dist/assets/art/roadside-vending.webp)

</details>
