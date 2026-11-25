/* Road-car measurements in metres. Look, sound, and tune share the same chassis ID. */
(() => {
  'use strict';
  const cars = {
    fd3s: {
      name:'Mazda ɛ̃fini RX-7', trim:'FD3S', short:'RX-7', label:'FD3S · RX-7', driver:'Keisuke Takahashi',
      spec:'Keisuke Takahashi · Type R · Sequential twin-turbo rotary · RWD',
      length:4.295, width:1.760, height:1.230, wheelbase:2.425, frontZ:-1.298, track:[1.460,1.460],
      wheel:[.317,.225,17,5,0xaeb2b5], paint:0xf9cd26, plate:'63-887', district:'37',kana:'お', badge:'ɛ̃fini', team:'RedSuns',
      curb:1260, launch:3220, roll:.031, engine:'13B-REW', idle:850, redline:8000, shift:7550,
      ratios:[3.483,2.015,1.391,1,.719], final:4.100, reverse:3.288, frontWeight:.50, inertia:1650, cg:.45,
      boostBar:.90, boostShare:.38, spool:[1650,3550,4.7], drive:'rwd', grip:[1.10,1.12], stiffness:[11.9,12.7],
      // Full-charge estimates in N m. The FD has a crossover as the secondary turbo comes on line.
      torque:[[850,102],[1800,176],[2600,284],[3700,360],[4350,336],[4950,377],[6100,390],[7100,345],[7650,290],[8000,170]]
    },
    fc3s: {
      name:'Mazda Savanna RX-7', trim:'FC3S', short:'Savanna', label:'FC3S · Savanna', driver:'Ryosuke Takahashi',
      spec:'Ryosuke Takahashi · ∞ III · Single-turbo rotary · RWD',
      length:4.335, width:1.690, height:1.270, wheelbase:2.430, frontZ:-1.213, track:[1.450,1.440],
      wheel:[.315,.215,17,5,0xb3b5b6], paint:0xf5f4ed, plate:'13-137',district:'58',kana:'よ', badge:'SAVANNA RX-7', team:'RedSuns',
      curb:1230, launch:3060, roll:.037, engine:'13B-T', idle:850, redline:7500, shift:7010,
      ratios:[3.483,2.015,1.391,1,.762], final:4.100, reverse:3.288, frontWeight:.51, inertia:1560, cg:.47,
      boostBar:.72, boostShare:.35, spool:[2100,4100,3.4], drive:'rwd', grip:[1.06,1.065], stiffness:[11.4,12.0],
      torque:[[850,103],[1800,147],[2900,229],[3900,302],[4900,318],[5950,301],[6500,281],[7080,246],[7500,154]]
    },
    gc8: {
      name:'Subaru Impreza WRX STi', trim:'GC8', short:'Impreza', label:'GC8 · Impreza', driver:'Bunta Fujiwara',
      spec:'Bunta Fujiwara · Type R Version V · 2.0 L turbo boxer · AWD',
      length:4.350, width:1.690, height:1.405, wheelbase:2.520, frontZ:-1.235, track:[1.470,1.460],
      wheel:[.306,.205,16,5,0xb99a52], paint:0x2f5b9e, plate:'13-600',district:'52',kana:'が', badge:'WRX', team:'',
      curb:1260, launch:3860, roll:.043, engine:'EJ20', idle:850, redline:8000, shift:7360,
      ratios:[3.083,2.062,1.545,1.151,.825], final:4.444, reverse:3.333, frontWeight:.585, inertia:1750, cg:.48,
      boostBar:1.14, boostShare:.44, spool:[2150,4000,3.5], drive:'dccd', grip:[1.05,1.08], stiffness:[11.9,12.9],
      torque:[[850,108],[1950,174],[2870,248],[3500,324],[4000,353],[4700,346],[5500,327],[6500,303],[7300,243],[8000,141]]
    },
    bnr32: {
      name:'Nissan Skyline GT-R', trim:'BNR32', short:'Skyline', label:'R32 · GT-R', driver:'Takeshi Nakazato',
      spec:'Takeshi Nakazato · V-spec II · 2.6 L twin-turbo six · ATTESA AWD',
      length:4.545, width:1.755, height:1.355, wheelbase:2.615, frontZ:-1.330, track:[1.480,1.480],
      wheel:[.326,.245,17,5,0x969ba1], paint:0x37383e, plate:'26-037',district:'33',kana:'が', badge:'SKYLINE', team:'NightKids',
      curb:1500, launch:4370, roll:.034, engine:'RB26DETT', idle:900, redline:8000, shift:7540,
      ratios:[3.214,1.925,1.302,1,.752], final:4.111, reverse:3.369, frontWeight:.59, inertia:2160, cg:.49,
      boostBar:1.0, boostShare:.43, spool:[2450,4300,3.1], drive:'attesa', grip:[1.095,1.12], stiffness:[12.6,14.1],
      torque:[[900,128],[2000,191],[2900,266],[3800,368],[4550,419],[5500,420],[6600,396],[7200,363],[7680,310],[8000,196]]
    }
  };
  window.TougeRivals = {cars};
})();
