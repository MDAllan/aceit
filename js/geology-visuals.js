const PROFILES = {
  investigation: { caption: "Geologists combine indirect observations to infer processes and structures that cannot be seen directly.", nodes: [["wave", "Measure", "Collect observations"], ["layers", "Compare", "Look for patterns"], ["earth", "Infer", "Test an Earth model"]] },
  chemical: { caption: "Earth separates into layers with different compositions and densities.", nodes: [["crust", "Crust", "Thin rocky shell"], ["mantle", "Mantle", "Silicate rock"], ["core", "Core", "Iron-rich center"]] },
  mechanical: { caption: "Earth's physical layers differ in strength and how they deform over time.", nodes: [["crust", "Lithosphere", "Rigid outer shell"], ["mantle", "Asthenosphere", "Weak, solid rock"], ["core", "Deep interior", "Hot and under pressure"]] },
  gradient: { caption: "Pressure, temperature, and density generally increase toward Earth's center.", nodes: [["crust", "Surface", "Lower pressure"], ["mantle", "Depth", "Heat and pressure rise"], ["core", "Center", "Highest density"]] },
  waves: { caption: "Seismic waves change speed and direction as they cross materials with different properties.", nodes: [["wave", "P waves", "Travel through solids and liquids"], ["wave", "S waves", "Do not cross liquid"], ["layers", "Wave paths", "Reveal hidden boundaries"]] },
  shadow: { caption: "The absence and bending of seismic waves create shadow zones that reveal a liquid outer core.", nodes: [["wave", "Earthquake", "Waves begin"], ["layers", "Liquid outer core", "S waves stop"], ["earth", "Shadow zone", "Wave gaps map structure"]] },
  gravity: { caption: "Gravity varies slightly across Earth because mass is unevenly distributed and the planet rotates.", nodes: [["earth", "Mass", "Uneven inside Earth"], ["layers", "Gravity", "Changes by location"], ["earth", "Geoid", "Shape of equal gravity"]] },
  buoyancy: { caption: "Crust floats in gravitational balance: thicker or lighter crust tends to stand higher.", nodes: [["layers", "Crust", "Floats in balance"], ["mantle", "Mantle", "Supports the crust"], ["earth", "Elevation", "Reflects density and thickness"]] },
  convection: { caption: "Heat escaping from Earth's interior drives slow circulation in the mantle.", nodes: [["heat", "Warm rock", "Rises slowly"], ["mantle", "Flow", "Rock circulates"], ["crust", "Cooler rock", "Sinks and returns"]] },
  geodynamo: { caption: "Flowing, electrically conducting liquid iron in the outer core generates Earth's magnetic field.", nodes: [["core", "Liquid iron", "Moves in outer core"], ["heat", "Convection", "Drives circulation"], ["earth", "Magnetic field", "Generated around Earth"]] },
  reflection: { caption: "Reflected seismic waves help build images of boundaries beneath Earth's surface.", nodes: [["wave", "Send a pulse", "Seismic energy travels"], ["layers", "Reflect", "Boundaries return echoes"], ["earth", "Image", "Combine the signals"]] },
  drift: { caption: "Continents now separated by oceans once fit together and share geological clues.", nodes: [["layers", "Match clues", "Fossils and rocks"], ["rift", "Separate", "Ocean basin opens"], ["earth", "Drift", "Continents change position"]] },
  tectonics: { caption: "Multiple lines of evidence connect moving plates to earthquakes, volcanoes, and ocean-floor patterns.", nodes: [["layers", "Observe", "Map the seafloor"], ["wave", "Compare", "Use quake and magnetic patterns"], ["rift", "Explain", "Plates move and interact"]] },
  boundaries: { caption: "Plate motion shapes the land differently where plates diverge, converge, or slide past.", nodes: [["rift", "Divergent", "Move apart"], ["collision", "Convergent", "Move together"], ["fault", "Transform", "Slide past"]] },
  subduction: { caption: "At a subduction zone, denser oceanic lithosphere sinks beneath another plate.", nodes: [["collision", "Converge", "Plates move together"], ["layers", "Subduct", "Oceanic plate sinks"], ["volcano", "Arc", "Magma may rise"]] },
  collision: { caption: "Continental collision shortens and thickens crust, building high mountain belts.", nodes: [["collision", "Converge", "Continents approach"], ["fold", "Thicken", "Crust shortens"], ["layers", "Mountains", "Thick roots support relief"]] },
  rifting: { caption: "Extension stretches continental crust; a mature rift can develop into a new ocean basin.", nodes: [["rift", "Stretch", "Crust pulls apart"], ["fault", "Thin", "Blocks drop along faults"], ["water", "Flood", "New basin may form"]] },
  spreading: { caption: "New oceanic crust forms at ridges and moves outward as the seafloor spreads.", nodes: [["magma", "Magma rises", "New crust forms"], ["layers", "Record reversals", "Magnetic stripes form"], ["transport", "Move outward", "Crust gets older"]] },
  transform: { caption: "Transform faults accommodate sideways motion between neighboring plates.", nodes: [["fault", "Lock", "Friction resists motion"], ["pressure", "Strain", "Stress builds"], ["rupture", "Slip", "Blocks move sideways"]] },
  driving: { caption: "Gravity and heat help move plates through slab pull, ridge forces, and mantle circulation.", nodes: [["heat", "Earth's heat", "Drives mantle flow"], ["collision", "Slab pull", "Dense plate sinks"], ["rift", "Ridge force", "Plates move apart"]] },
  hotspot: { caption: "A mantle plume can make a chain of volcanoes as a tectonic plate moves over it.", nodes: [["magma", "Plume", "Hot rock rises"], ["volcano", "Volcano", "Erupts above plume"], ["timeline", "Track motion", "A chain records movement"]] },
  mineral: { caption: "Mineral identity comes from a combination of composition, structure, and observable properties.", nodes: [["crystal", "Structure", "Ordered atoms"], ["scratch", "Properties", "Test hardness and streak"], ["cleavage", "Identify", "Compare diagnostic clues"]] },
  crystal: { caption: "Atoms link in repeating arrangements that control crystal shape and mineral properties.", nodes: [["crystal", "Atoms", "Bond together"], ["layers", "Lattice", "Repeating structure"], ["crystal", "Crystal", "Grows in a pattern"]] },
  formation: { caption: "Minerals crystallize as magma cools or as dissolved material precipitates from water.", nodes: [["magma", "Melt or solution", "Supplies elements"], ["cooling", "Crystallize", "Atoms arrange"], ["crystal", "Mineral", "A solid forms"]] },
  hardness: { caption: "A scratch test ranks hardness by checking which mineral scratches another.", nodes: [["scratch", "Test", "Try a scratch"], ["crystal", "Compare", "Use known references"], ["mineral", "Rank", "Place on Mohs scale"]] },
  silicate: { caption: "Silicate minerals are built from silicon–oxygen tetrahedra linked in different arrangements.", nodes: [["crystal", "Tetrahedron", "One silicon, four oxygen"], ["layers", "Link units", "Share oxygen atoms"], ["mineral", "Silicate", "Build mineral structures"]] },
  rockcycle: { caption: "Magma cools into igneous rock; melting, weathering, and burial can transform it again.", nodes: [["magma", "Melt", "Magma forms"], ["cooling", "Cool", "Igneous rock crystallizes"], ["weather", "Change", "Weathering or melting continues the cycle"]] },
  melting: { caption: "Decompression, added water, or heat can cause solid rock to begin melting.", nodes: [["pressure", "Decompression", "Pressure drops"], ["water", "Add water", "Melting temperature falls"], ["heat", "Add heat", "Rock can melt"]] },
  magma: { caption: "Magma composition and cooling history shape crystals, viscosity, and the resulting rock.", nodes: [["magma", "Magma", "Composition varies"], ["transport", "Move", "Melt rises or erupts"], ["cooling", "Cool", "Texture and rock form"]] },
  differentiation: { caption: "As magma cools, minerals crystallize in sequence and the remaining melt changes composition.", nodes: [["magma", "Starting melt", "Mixed composition"], ["crystal", "Crystallize", "Some minerals form first"], ["magma", "Remaining melt", "Composition evolves"]] },
  texture: { caption: "Cooling rate controls crystal size: slow cooling grows larger crystals; rapid cooling makes finer textures.", nodes: [["magma", "Melt", "Crystals have not formed"], ["cooling", "Cool slowly", "Crystals have time to grow"], ["crystal", "Fine or coarse", "Texture records cooling"]] },
  intrusion: { caption: "Magma that cools underground forms intrusive bodies such as dikes, sills, and plutons.", nodes: [["magma", "Magma", "Moves through crust"], ["fault", "Intrude", "Cuts across or follows layers"], ["cooling", "Solidify", "An igneous body remains"]] },
  volcano: { caption: "Volcano shape reflects magma properties, eruption style, and the materials deposited over time.", nodes: [["magma", "Magma", "Rises toward surface"], ["volcano", "Erupt", "Lava and fragments emerge"], ["layers", "Build", "Layers shape the volcano"]] },
  eruption: { caption: "Viscosity and gas content affect how easily magma flows and whether an eruption is explosive.", nodes: [["magma", "Magma", "Viscosity varies"], ["gas", "Gas expands", "Pressure builds"], ["volcano", "Erupt", "Style and hazards differ"]] },
  products: { caption: "Eruptions release lava, volcanic fragments, and gases that move and settle in different ways.", nodes: [["volcano", "Erupt", "Magma and gas escape"], ["magma", "Lava", "Flows along the ground"], ["layers", "Ash and blocks", "Fragments settle"]] },
  hazards: { caption: "Lava, ash, hot currents, and lahars pose different hazards at different distances from a volcano.", nodes: [["volcano", "Source", "Eruption releases material"], ["transport", "Travel", "Flows and ash move"], ["earth", "Impact", "Exposure shapes risk"]] },
  monitoring: { caption: "Changes in earthquakes, ground shape, and volcanic gases can signal changing activity.", nodes: [["wave", "Seismicity", "Track earthquakes"], ["layers", "Deformation", "Measure swelling"], ["volcano", "Gas", "Watch emissions"]] },
  planets: { caption: "Volcanic landforms and lava reveal that volcanism has shaped other worlds as well as Earth.", nodes: [["magma", "Melt", "Rock becomes mobile"], ["volcano", "Erupt", "Volcanism reshapes a surface"], ["earth", "Compare worlds", "Gravity and climate differ"]] },
  weathering: { caption: "Physical and chemical weathering break down rock and supply sediment to landscapes.", nodes: [["weather", "Break down", "Rock is exposed"], ["water", "Weather", "Water and climate act"], ["transport", "Sediment", "Material becomes mobile"]] },
  soil: { caption: "Soil develops from weathered parent material, organic matter, water, and time.", nodes: [["weather", "Parent material", "Rock weathers"], ["fossil", "Organic matter", "Life adds material"], ["layers", "Soil horizons", "Layers develop"]] },
  sediment: { caption: "Sediment is transported, deposited, buried, and eventually cemented into sedimentary rock.", nodes: [["weather", "Weather", "Make particles"], ["transport", "Transport", "Move sediment"], ["layers", "Deposit", "Bury and lithify"]] },
  structure: { caption: "Layers, ripples, and other sedimentary structures preserve clues to past flow and deposition.", nodes: [["transport", "Flow", "Water or wind moves"], ["layers", "Deposit", "Sediment settles"], ["layers", "Structure", "Patterns are preserved"]] },
  environment: { caption: "Sediment type and structures help identify the environment where a layer formed.", nodes: [["transport", "Carry sediment", "Environment moves material"], ["layers", "Deposit", "Facies vary across a basin"], ["earth", "Interpret", "Infer the environment"]] },
  metamorphism: { caption: "Heat, pressure, and fluids change minerals and textures while rock remains solid.", nodes: [["heat", "Heat", "Speeds mineral reactions"], ["pressure", "Stress", "Changes mineral alignment"], ["crystal", "Recrystallize", "New texture forms"]] },
  grade: { caption: "Index minerals and textures help track increasing metamorphic grade and changing conditions.", nodes: [["crystal", "Low grade", "Early mineral changes"], ["layers", "Higher grade", "Minerals reorganize"], ["heat", "Conditions", "Temperature and pressure rise"]] },
  contact: { caption: "A hot intrusion heats nearby country rock, creating a metamorphic aureole.", nodes: [["magma", "Intrusion", "Hot magma enters"], ["heat", "Transfer heat", "Nearby rock changes"], ["crystal", "Aureole", "Metamorphic zone forms"]] },
  exhumation: { caption: "Uplift and erosion can bring deeply buried rocks back to the surface.", nodes: [["layers", "Burial", "Rock moves deeper"], ["pressure", "Metamorphism", "Conditions change"], ["weather", "Exhumation", "Uplift and erosion expose rock"]] },
  deepTime: { caption: "Geologic time records Earth history across billions of years and many kinds of evidence.", nodes: [["layers", "Relative order", "Place events in sequence"], ["fossil", "Fossils", "Correlate rock layers"], ["timeline", "Deep time", "Build the long history"]] },
  dating: { caption: "Relative dating orders events; radiometric dating can estimate numerical ages.", nodes: [["layers", "Relative time", "Earlier or later"], ["fossil", "Correlate", "Match rock records"], ["crystal", "Numerical age", "Use isotope decay"]] },
  unconformity: { caption: "An unconformity marks time missing from the rock record through erosion or non-deposition.", nodes: [["layers", "Deposit", "Older layers form"], ["weather", "Erode or pause", "Time is missing"], ["layers", "Resume", "Younger layers cover the gap"]] },
  isotopes: { caption: "Radioactive parent isotopes decay at known rates, providing clocks for suitable rocks.", nodes: [["crystal", "Parent isotope", "Starts in a mineral"], ["timeline", "Decay", "Half-life passes"], ["crystal", "Daughter isotope", "Measure the ratio"]] },
  fossil: { caption: "Burial and preservation turn remains or traces of past life into evidence in rock.", nodes: [["fossil", "Life", "Organism or trace"], ["layers", "Burial", "Sediment protects evidence"], ["fossil", "Fossil", "Preserved in rock"]] },
  evolution: { caption: "Inherited variation and differential survival can change populations over generations.", nodes: [["fossil", "Variation", "Individuals differ"], ["earth", "Selection", "Environment affects survival"], ["timeline", "Change", "Populations evolve"]] },
  extinction: { caption: "Extinction removes lineages; changes in fossil assemblages help identify major events.", nodes: [["fossil", "Fossil record", "Assemblages change"], ["earth", "Disturbance", "Environmental stress"], ["timeline", "Extinction", "Some lineages disappear"]] },
  history: { caption: "Earth history links changing continents, oceans, climate, and life through geologic time.", nodes: [["earth", "Early Earth", "A changing planet"], ["layers", "Surface changes", "Crust, oceans, and climate"], ["timeline", "Life evolves", "Across deep time"]] },
  hadean: { caption: "The Hadean Earth cooled from a hot, heavily bombarded planet toward a crust with early oceans.", nodes: [["magma", "Molten Earth", "Early surface was hot"], ["earth", "Impacts", "Large collisions shaped Earth"], ["water", "Cooling", "Crust and early oceans formed"]] },
  earlyCrust: { caption: "Repeated melting and volcanism helped build the first long-lived continental crust.", nodes: [["collision", "Subduction", "Plates recycle rock"], ["volcano", "Arcs", "Magma rises"], ["layers", "Crust grows", "Continental fragments join"]] },
  earlyLife: { caption: "Archean rocks preserve evidence of early crust and microbial life.", nodes: [["earth", "Early crust", "Ancient rocks survive"], ["fossil", "Microbes", "Life leaves traces"], ["layers", "Preservation", "Evidence enters the rock record"]] },
  cratons: { caption: "Stable cratons preserve ancient cores that later joined to form larger continents.", nodes: [["layers", "Craton", "Stable continental core"], ["collision", "Assembly", "Blocks join"], ["earth", "North America", "A larger continent develops"]] },
  oxygen: { caption: "Photosynthetic life gradually added oxygen to the atmosphere during Proterozoic time.", nodes: [["fossil", "Photosynthesis", "Microbes release oxygen"], ["earth", "Oxygen rises", "Atmosphere changes"], ["layers", "New conditions", "Life and rocks respond"]] },
  snowball: { caption: "Major Proterozoic glaciations left evidence of ice reaching low latitudes.", nodes: [["earth", "Cooling", "Ice expands"], ["layers", "Glaciation", "Ice alters landscapes"], ["fossil", "After the ice", "Climate and life change"]] },
  paleoGeo: { caption: "Paleozoic geography changed as seas advanced, mountain belts formed, and continents assembled.", nodes: [["water", "Shallow seas", "Cover continental margins"], ["collision", "Orogenies", "Continents converge"], ["earth", "Pangaea", "A supercontinent assembles"]] },
  paleozoic: { caption: "Paleozoic life diversified in the seas and on land before the end-Permian mass extinction.", nodes: [["fossil", "Marine life", "Diversity expands"], ["earth", "Life on land", "Plants and animals spread"], ["timeline", "End-Permian", "Mass extinction reshapes life"]] },
  mesoGeo: { caption: "The breakup of Pangaea opened new ocean basins while western North America grew through accretion.", nodes: [["earth", "Pangaea", "Continents joined"], ["rift", "Breakup", "New ocean basins open"], ["collision", "Accretion", "Terranes join the west coast"]] },
  mesozoic: { caption: "Mesozoic ecosystems included dinosaurs and ended with a major mass extinction.", nodes: [["fossil", "Triassic", "Life recovers and diversifies"], ["fossil", "Jurassic–Cretaceous", "Dinosaurs flourish"], ["timeline", "End-Cretaceous", "Mass extinction"]] },
  impact: { caption: "A large impact at the K–Pg boundary caused rapid environmental disruption and a mass extinction.", nodes: [["earth", "Impact", "Asteroid reaches Earth"], ["layers", "Global effects", "Dust and climate disruption"], ["fossil", "Recovery", "Surviving groups diversify"]] },
  cenoGeo: { caption: "Cenozoic plate motion built mountain belts and helped shape western North America's basins and ranges.", nodes: [["collision", "Plate convergence", "Continents approach"], ["fold", "Mountain building", "Crust deforms"], ["layers", "Basin and Range", "Crust stretches"]] },
  cenozoic: { caption: "Mammals diversified during the Cenozoic as continents, climates, and ecosystems changed.", nodes: [["fossil", "Mammals diversify", "New groups spread"], ["earth", "Climate shifts", "Ice ages recur"], ["timeline", "Recent Earth", "Landscapes keep changing"]] },
  strain: { caption: "Stress changes rock shape; strain records the resulting deformation.", nodes: [["pressure", "Stress", "Force acts on rock"], ["fold", "Strain", "Shape changes"], ["fault", "Deformation", "Rock bends or breaks"]] },
  fault: { caption: "Fault geometry and the direction of displacement distinguish normal, reverse, and strike-slip motion.", nodes: [["pressure", "Stress", "Pull, push, or shear"], ["fault", "Fault", "Rock blocks separate"], ["rupture", "Slip", "Classify the motion"]] },
  fold: { caption: "Layered rocks can bend into folds under compression and ductile deformation.", nodes: [["pressure", "Compression", "Layers shorten"], ["fold", "Fold", "Layers bend"], ["layers", "Read the shape", "Name fold geometry"]] },
  mountain: { caption: "Tectonic forces can thicken crust, form mountain roots, and create broad basins.", nodes: [["collision", "Tectonic force", "Crust shortens or stretches"], ["fold", "Deform", "Layers bend or break"], ["layers", "Relief", "Mountains or basins form"]] },
  slope: { caption: "Slope failure occurs when downslope driving forces overcome the strength holding material in place.", nodes: [["slope", "Slope", "Gravity pulls downslope"], ["water", "Stability falls", "Water or weak layers matter"], ["slide", "Failure", "Material moves downhill"]] },
  movement: { caption: "Creep, slides, falls, and flows differ in how material moves downslope.", nodes: [["slope", "Material loosens", "Slope loses stability"], ["transport", "Movement", "Creep, slide, fall, or flow"], ["layers", "Deposit", "Material comes to rest"]] },
  earthquake: { caption: "Elastic strain accumulates on a locked fault and is released when the fault slips.", nodes: [["fault", "Locked fault", "Plates continue moving"], ["pressure", "Strain", "Stress accumulates"], ["rupture", "Earthquake", "Slip releases energy"]] },
  seismic: { caption: "P, S, and surface waves move differently and leave different patterns of shaking.", nodes: [["wave", "P wave", "Compressional body wave"], ["wave", "S wave", "Shear body wave"], ["wave", "Surface waves", "Move along the surface"]] },
  magnitude: { caption: "Magnitude describes earthquake size; intensity describes shaking and effects at a location.", nodes: [["rupture", "Rupture", "Fault releases energy"], ["wave", "Magnitude", "Estimate source size"], ["earth", "Intensity", "Describe local effects"]] },
  tsunami: { caption: "A tsunami can form when seafloor displacement moves a large volume of water.", nodes: [["rupture", "Seafloor moves", "Water is displaced"], ["wave", "Long wave", "Crosses the ocean"], ["earth", "Coast", "Wave grows in shallow water"]] },
  runoff: { caption: "Water added by rain, snowmelt and groundwater runs off the land in streams that erode, carry and deposit sediment.", nodes: [["weather", "Water arrives", "Rain, melt and groundwater"], ["water", "Runoff", "Flows over the land"], ["transport", "Shapes land", "Erodes, carries, deposits"]] },
  channel: { caption: "Sheetwash cuts rills that join into one channel, and headward erosion extends it uphill.", nodes: [["slope", "Sheetwash", "Thin water on a slope"], ["water", "Rills join", "Flow gathers"], ["transport", "Channel grows", "Headward erosion"]] },
  drainagePattern: { caption: "The pattern of a drainage network reflects the rock and structure beneath it.", nodes: [["layers", "Underlying rock", "Uniform, jointed or folded"], ["water", "Water follows", "The easiest path"], ["earth", "Pattern", "Dendritic, radial, trellis..."]] },
  watershed: { caption: "A divide splits the land into drainage basins that each feed one trunk stream.", nodes: [["slope", "Divide", "High line between basins"], ["water", "Basin", "Drains to one stream"], ["earth", "Ocean", "Continental divides split flow"]] },
  streamflow: { caption: "Discharge is cross-sectional area times velocity, and the water moves fastest in the deep centre.", nodes: [["water", "Area", "Width and depth"], ["transport", "Velocity", "Fastest mid-channel"], ["wave", "Discharge", "Volume per second"]] },
  streamErosion: { caption: "Streams turn gravitational energy into motion that scours, breaks, abrades and dissolves rock.", nodes: [["weather", "Sun lifts water", "Evaporation"], ["slope", "Gravity", "Potential to kinetic"], ["rupture", "Erosion", "Scour, break, abrade"]] },
  sedimentLoad: { caption: "Streams carry bed, suspended and dissolved load, and drop grains by size as they slow.", nodes: [["transport", "Bed load", "Rolls and bounces"], ["water", "Suspended", "Silt and clay"], ["layers", "Sorted deposit", "Slower water, finer grains"]] },
  longProfile: { caption: "From steep headwaters to a flat mouth, gradient falls while discharge rises.", nodes: [["slope", "Headwaters", "Steep and coarse"], ["water", "Trunk stream", "More discharge"], ["layers", "Mouth", "Flat and fine"]] },
  baseLevel: { caption: "Base level is the lowest level a stream can erode to; moving it changes erosion and deposition.", nodes: [["water", "Sea level", "Ultimate base level"], ["layers", "Raise it", "More deposition"], ["rupture", "Lower it", "Faster erosion"]] },
  canyon: { caption: "Hard and soft layers, base-level changes and waterfalls shape valleys and canyons.", nodes: [["layers", "Hard and soft rock", "Cliffs and slopes"], ["rupture", "Downcutting", "Terraces remain"], ["water", "Waterfall", "Retreats upstream"]] },
  fanBraid: { caption: "Where a stream slows or is overloaded, it drops sediment into fans and braided bars.", nodes: [["slope", "Mountain front", "Gradient drops"], ["transport", "Too much sediment", "Channels choke"], ["layers", "Fans and bars", "Sediment piles up"]] },
  meander: { caption: "Meanders erode on the outside, build point bars inside, and are cut off into oxbow lakes.", nodes: [["rupture", "Cut bank", "Outside erodes"], ["layers", "Point bar", "Inside builds"], ["water", "Oxbow lake", "Loop cut off"]] },
  drainageChange: { caption: "Capture, uplift and old courses change where streams run over time.", nodes: [["transport", "Piracy", "One stream captures another"], ["collision", "Uplift", "Rejuvenation or diversion"], ["layers", "Old course kept", "Superposed and antecedent"]] },
  delta: { caption: "At standing water a stream slows, drops its load and builds a delta that can switch course.", nodes: [["water", "Standing water", "Current slows"], ["layers", "Deposit", "Distributary channels"], ["timeline", "Avulsion", "Channel jumps over time"]] },
  flood: { caption: "Heavy rain, saturated ground, fast snowmelt or a dam break send water over the banks.", nodes: [["weather", "Cause", "Rain, melt or dam break"], ["water", "Discharge rises", "Water leaves the channel"], ["earth", "Damage", "Floodplains scoured"]] },
  floodRisk: { caption: "Recurrence intervals, risk maps, floodways and levees are used to manage flood risk.", nodes: [["timeline", "Recurrence", "Chance each year"], ["earth", "Risk maps", "Where water will reach"], ["layers", "Control", "Levees, dams, floodways"]] },
  riverUse: { caption: "Rivers supply water, food, transport and energy, but pollution, dams and overuse strain them.", nodes: [["water", "Rivers give", "Water, food, energy"], ["gas", "Pollution", "Sewage, metals, salt, oil"], ["slope", "Overuse", "Too little left"]] },
  gwStorage: { caption: "Most of Earth's water is in the ocean and ice; groundwater holds far more than lakes and rivers.", nodes: [["water", "Ocean", "97% of all water"], ["layers", "Groundwater", "1.1%, mostly hidden"], ["weather", "Cycle", "Water moves between reservoirs"]] },
  gwPorosity: { caption: "Groundwater sits in pore space that formed with the rock or was opened up later.", nodes: [["layers", "Pores", "Open space in rock"], ["crystal", "Primary", "Formed with the rock"], ["rupture", "Secondary", "Fractures and cavities"]] },
  gwPermeability: { caption: "Permeability measures how easily water flows through connected pores.", nodes: [["layers", "Pores", "Hold the water"], ["transport", "Connections", "Link pore to pore"], ["water", "Flow", "Fast or slow"]] },
  gwAquifer: { caption: "Aquifers transmit water easily; aquitards hinder flow and can shield confined aquifers.", nodes: [["water", "Unconfined aquifer", "Open to the surface"], ["layers", "Aquitard", "Hinders flow"], ["pressure", "Confined aquifer", "Protected below"]] },
  gwWaterTable: { caption: "The water table tops the saturated zone and follows the land surface in a gentler form.", nodes: [["weather", "Unsaturated zone", "Air and water"], ["water", "Water table", "Top of saturated zone"], ["layers", "Saturated zone", "All pores full"]] },
  gwFlow: { caption: "Groundwater moves slowly from high hydraulic head at recharge areas to low head at discharge areas.", nodes: [["slope", "Recharge", "Water enters up high"], ["transport", "Slow flow", "Curving paths"], ["water", "Discharge", "Water exits down low"]] },
  gwDarcy: { caption: "Darcy's law: flow rate equals permeability times the hydraulic gradient.", nodes: [["pressure", "Head drop", "h1 minus h2"], ["slope", "Gradient", "Divide by path length"], ["transport", "Flow rate", "Times permeability"]] },
  gwWells: { caption: "Pumping draws the water table into a cone; confined aquifers can push water up artesian wells.", nodes: [["water", "Pump", "Water drawn out"], ["slope", "Cone of depression", "Water table dips"], ["pressure", "Artesian", "Pressure lifts water"]] },
  gwSprings: { caption: "Springs flow where the water table, a barrier, a layer contrast or fractures send groundwater to the surface.", nodes: [["layers", "Groundwater", "Moving underground"], ["fault", "Barrier or contrast", "Blocks the path"], ["water", "Spring", "Water reaches the surface"]] },
  gwHot: { caption: "Deep or magma-heated groundwater returns as hot springs, and geysers erupt when pressure drops.", nodes: [["magma", "Heat", "Gradient or magma"], ["pressure", "Held down", "Water above stops boiling"], ["gas", "Eruption", "Pressure drops, steam bursts"]] },
  gwDepletion: { caption: "Pumping faster than recharge lowers the water table and dries up swamps, streams and wells.", nodes: [["water", "Heavy pumping", "Faster than refill"], ["slope", "Water table falls", "Cones grow"], ["earth", "Surface dries", "Swamps and streams lost"]] },
  gwPumping: { caption: "Overpumping can reverse flow, pull in salt water and make the land subside for good.", nodes: [["transport", "Reversed flow", "Waste reaches wells"], ["water", "Saltwater", "Boundary rises"], ["layers", "Subsidence", "Pores collapse"]] },
  gwQuality: { caption: "Groundwater is filtered by porous material but can carry natural substances such as iron and arsenic.", nodes: [["layers", "Filtering", "Pores and clay"], ["mineral", "Natural substances", "Iron, arsenic, sulfide"], ["water", "Treatment", "Removes harmful levels"]] },
  gwPollution: { caption: "Septic systems, farms, chemicals, fuel, landfills and mines can all contaminate groundwater.", nodes: [["earth", "Sources", "On or in the ground"], ["weather", "Infiltration", "Rain carries it down"], ["water", "Aquifer", "Water is polluted"]] },
  gwPlume: { caption: "Contaminants spread downgradient as a plume and are costly to clean up.", nodes: [["gas", "Source", "Highest concentration"], ["transport", "Plume", "Spreads with the flow"], ["water", "Cleanup", "Remove source, pump, bacteria"]] },
  gwCaves: { caption: "Carbonic acid dissolves limestone into caves, and degassing water grows dripstone inside them.", nodes: [["weather", "Carbonic acid", "Water plus CO2"], ["layers", "Dissolve", "Along joints and beds"], ["crystal", "Speleothems", "Calcite deposits"]] },
  gwKarst: { caption: "Dissolution, a dropping water table and roof collapse build karst landscapes.", nodes: [["layers", "Dissolution", "Near the water table"], ["water", "Caves drain", "Water table drops"], ["rupture", "Sinkholes", "Roofs collapse"]] },
  resEnergy: { caption: "An energy resource is matter that can do work; in usable form it is a fuel, and fossil fuels now supply over 75% of our energy.", nodes: [["weather", "Sunlight", "The main source"], ["layers", "Stored in rock", "Fossil fuels"], ["heat", "Fuel", "Heat, power, motion"]] },
  resSources: { caption: "Sun, gravity, both together, photosynthesis, chemical bonds, fission and Earth's heat: seven sources of energy.", nodes: [["weather", "Sun and gravity", "Light, tides, wind, rivers"], ["fossil", "Chemical bonds", "Photosynthesis, fuel cells"], ["core", "Atoms and heat", "Fission, geothermal"]] },
  resOilForm: { caption: "Buried organic debris becomes kerogen in black shale, and heat in the oil window turns it into oil and gas.", nodes: [["fossil", "Organic debris", "Anoxic sea floor"], ["layers", "Kerogen", "Black shale source rock"], ["heat", "Oil and gas", "90-160 °C window"]] },
  resTrap: { caption: "Oil migrates from the source rock into a porous reservoir and is held there by a trap and a low-permeability seal.", nodes: [["layers", "Source rock", "Oil forms"], ["transport", "Migration", "Into a porous reservoir"], ["fold", "Trap and seal", "Arch or salt dome"]] },
  resOilWhere: { caption: "The oil industry began with the 1859 Drake well; today the largest reserves surround the Persian Gulf.", nodes: [["timeline", "1859", "First oil well"], ["transport", "Lamps then cars", "An oil addiction"], ["earth", "Reserves", "Every continent; Persian Gulf most"]] },
  resProduction: { caption: "Geologists map rocks, image traps with sound, drill and pump the oil, then refine it.", nodes: [["wave", "Seismic image", "Find a trap"], ["rupture", "Drill and pump", "About 30% recovered"], ["gas", "Refine", "Separate the compounds"]] },
  resUnconv: { caption: "Natural gas, tar sands and oil shale are hydrocarbons that are harder to extract than conventional oil.", nodes: [["gas", "Natural gas", "Methane to butane"], ["slope", "Tar sands", "Bitumen must be mined"], ["layers", "Oil shale", "Kerogen must be heated"]] },
  resCoal: { caption: "Swamp plants that did not decay were compacted into peat and buried and heated into coal.", nodes: [["fossil", "Swamp plants", "No oxygen, no decay"], ["layers", "Peat", "Compacted debris"], ["pressure", "Coal", "Buried 4-10 km; over 70% C"]] },
  resCoalMine: { caption: "Shallow coal is strip-mined, deeper coal is tunnelled, and coal can also give methane and gas.", nodes: [["slope", "Strip mine", "Within about 100 m"], ["rupture", "Underground", "Tunnels; dangerous"], ["gas", "Methane and gas", "Coalbed methane, gasification"]] },
  resNuclear: { caption: "Fission of uranium-235 heats water to spin turbines, but reactors must be cooled and the waste stored for millennia.", nodes: [["mineral", "Uranium", "0.7% is U-235"], ["heat", "Fission", "Control rods slow it"], ["gas", "Waste", "Toxic for thousands of years"]] },
  resAlternatives: { caption: "Biofuels, geothermal, hydroelectric, wind, solar and fuel cells offer other energy choices.", nodes: [["fossil", "Biofuels", "Ethanol, biodiesel"], ["water", "Water and wind", "Turbines"], ["weather", "Sun and hydrogen", "Solar cells, fuel cells"]] },
  resChoices: { caption: "Oil production rises, peaks and falls, while burning fossil fuels pollutes the air and warms the climate.", nodes: [["timeline", "Oil Age", "About 300 years"], ["slope", "Peak oil", "Hubbert's curve"], ["gas", "Pollution", "Smog, acid rain, CO2"]] },
  resMinerals: { caption: "Mineral resources are metallic or nonmetallic; ore is rock rich enough in metal to mine for a profit.", nodes: [["mineral", "Metallic", "Gold, copper, iron..."], ["crystal", "Nonmetallic", "Sand, gypsum, salt..."], ["earth", "Ore", "Economic to mine"]] },
  resOreHot: { caption: "Magma and hot water concentrate metals: sulfides sink in magma, and hot fluids leave veins and black smokers.", nodes: [["magma", "Magmatic", "Sulfides sink"], ["water", "Hydrothermal", "Hot water leaches metals"], ["mineral", "Ore", "Veins, smokers, MVT"]] },
  resOreCool: { caption: "At the surface, sediment, tropical weathering and running water also concentrate ore minerals.", nodes: [["layers", "Sedimentary", "Banded iron formations"], ["weather", "Weathering", "Bauxite in the tropics"], ["water", "Running water", "Placer gold, tin, iron"]] },
  resMining: { caption: "Ores form mostly near plate boundaries, are found by surveys and drilling, and are mined from pits or tunnels.", nodes: [["collision", "Tectonics", "Where ores form"], ["wave", "Surveys", "Geophysics, geochemistry"], ["rupture", "Mining", "Open pit or underground"]] },
  resNonmetal: { caption: "Nonmetallic resources such as stone, aggregate, gypsum and quartz build our homes and roads.", nodes: [["layers", "Dimension stone", "Building slabs"], ["slope", "Crushed stone", "Roads, concrete"], ["crystal", "Home minerals", "Gypsum, clay, quartz"]] },
  resFuture: { caption: "Minerals are nonrenewable, so their lifetime is limited, and mining leaves scars, tailings and acid drainage.", nodes: [["timeline", "Lifetime", "Reserves ÷ yearly use"], ["rupture", "Mines", "Scars and tailings"], ["water", "Acid drainage", "Rusted, lifeless streams"]] },
};

const SECTION_PROFILES = {
  streams: {
    runoff: "draining", channel: "forming", drainagePattern: "patterns", watershed: "basins", streamflow: "flow",
    streamErosion: "erosion", sedimentLoad: "load", longProfile: "profile", baseLevel: "baselevel", canyon: "valleys",
    fanBraid: "fans", meander: "meanders", drainageChange: "evolution", delta: "deltas", flood: "floods",
    floodRisk: "living", riverUse: "resource",
  },
  groundwater: {
    gwStorage: "water", gwPorosity: "porosity", gwPermeability: "permeability", gwAquifer: "aquifers", gwWaterTable: "watertable",
    gwFlow: "flow", gwDarcy: "darcy", gwWells: "wells", gwSprings: "springs", gwHot: "hot", gwDepletion: "depletion",
    gwPumping: "pumping", gwQuality: "quality", gwPollution: "pollution", gwPlume: "plumes", gwCaves: "caves", gwKarst: "karst",
  },
  resources: {
    resEnergy: "energy", resSources: "sources", resOilForm: "oilgas", resTrap: "traps", resOilWhere: "oilwhere",
    resProduction: "production", resUnconv: "unconventional", resCoal: "coal", resCoalMine: "coalmining", resNuclear: "nuclear",
    resAlternatives: "alternatives", resChoices: "choices", resMinerals: "minerals", resOreHot: "orehot", resOreCool: "orecool",
    resMining: "oremining", resNonmetal: "nonmetal", resFuture: "future",
  },
  interior: {
    investigation: "probes", chemical: "chemical", mechanical: "physical", gradient: "density-temp",
    waves: "waves", shadow: "shadow", gravity: "gravity", buoyancy: "isostasy",
    convection: "heat-convection", geodynamo: "magnetic", reflection: "reflection",
  },
  plates: {
    drift: "wegener", tectonics: "evidence", mechanical: "layers", boundaries: "types",
    subduction: "subduction", collision: "collision", rifting: "rifts", spreading: "ridges",
    transform: "transform", driving: "forces", hotspot: "hotspots",
  },
  minerals: {
    mineral: "definition not-mineral identify special elements rockforming",
    crystal: "atoms-bonds crystal-growth", formation: "formation",
    hardness: "hardness cleavage", silicate: "silicates",
  },
  igneous: {
    magma: "magma-lava settings vary silica", melting: "melting", eruption: "volcanoes prof-q",
    differentiation: "fractional", texture: "classify textures", intrusion: "dikes plutons",
  },
  "volcanic-eruptions": {
    subduction: "volcanic-settings", eruption: "eruption-style", products: "eruption-products",
    volcano: "volcanic-architecture", hazards: "volcanic-hazards",
    monitoring: "eruption-monitoring", planets: "volcanoes-beyond-earth",
  },
  sedimentary: {
    weathering: "water wtypes wmech wchem", soil: "soil soilclass", sediment: "sedintro clastic nonclastic",
    structure: "structures", environment: "env basins",
  },
  metamorphism: {
    metamorphism: "what-is-meta texture-foliation five-processes agents nonfoliated",
    grade: "foliated-rocks grade-facies", contact: "types-contact",
    mountain: "dynamic-regional other-settings", exhumation: "exhumation slide-quiz",
  },
  strat: {
    deepTime: "deep", dating: "unif principles apply fossil corr scale age",
    unconformity: "uncon", isotopes: "decay iso",
  },
  fossils: {
    fossil: "succession timeline types trace incomplete archean shelly dna",
    evolution: "evolution", extinction: "extinction",
  },
  biography: {
    hadean: "hadean", earlyCrust: "arcs", earlyLife: "archean", cratons: "cratons",
    oxygen: "proterozoic", snowball: "glaciation", paleoGeo: "paleo-geo",
    paleozoic: "paleozoic", mesoGeo: "meso-geo", mesozoic: "mesozoic",
    impact: "kpg", cenoGeo: "ceno-geo", cenozoic: "cenozoic", history: "clicker",
  },
  deformation: {
    strain: "basics stress brittle joints faultclues", fault: "faults",
    fold: "folds foldparts domes", mountain: "collision boundaries interiors",
  },
  massmovement: {
    slope: "overview stability water-weak-layers", movement: "creep-slumps flows slides-falls submarine",
  },
  earthquakes: {
    earthquake: "earthquake-cycle", fault: "fault-motion",
    waves: "earthquake-location", seismic: "seismic-waves", magnitude: "earthquake-size",
    slope: "shaking-hazards", tsunami: "tsunami-prediction",
  },
};

function sectionProfile(lectureId, sectionId) {
  const profiles = SECTION_PROFILES[lectureId];
  if (!profiles) return null;
  for (const [profile, sectionIds] of Object.entries(profiles)) {
    if (sectionIds.split(/\s+/).includes(sectionId)) return profile;
  }
  return null;
}

export function geologyVisualContent(lectureId, section) {
  const profile = (PROFILES[section?.visual] && section.visual) || sectionProfile(lectureId, section?.id);
  const definition = PROFILES[profile];
  if (!definition) return null;
  return { profile, title: section.title, caption: definition.caption, nodes: definition.nodes };
}

export function geologyVisual(id, section) {
  const figure = geologyVisualContent(id, section);
  if (!figure) return "";
  const element = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  const diagram = element("div", "geo-diagram");
  diagram.setAttribute("aria-hidden", "true");
  diagram.append(element("span", "geo-track"), element("span", "geo-traveler"));
  for (const [shape, title, detail] of figure.nodes) {
    const node = element("div", "geo-node");
    node.append(element("span", `geo-symbol ${shape}`), element("strong", "", title), element("small", "", detail));
    diagram.append(node);
  }
  const caption = element("figcaption");
  caption.append(element("strong", "", figure.title), element("span", "", figure.caption));
  const result = element("figure", "geo-visual");
  result.setAttribute("aria-label", `${figure.title}. ${figure.caption}`);
  result.append(diagram, caption);
  return result;
}

export const geologyVisualIds = Object.keys(SECTION_PROFILES);
