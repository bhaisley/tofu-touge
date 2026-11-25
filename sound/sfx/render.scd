/*
   Tofu Touge original effects. Run render.py in this directory to render and
   master the driving bank. A four-stroke inline-four fires twice per turn.
   All engine voices share a crank reference so playback can crossfade them
   while the pitch follows the simulated engine through shifts and wheelspin.
*/
(
var output = "TOFU_SFX_RAW".getenv;
var options = ServerOptions.new.numOutputBusChannels_(1).numInputBusChannels_(0).sampleRate_(32000);
var recipes, render, makeRival, rivals;
var makeEngine, engine, trueno, tires, air, shifter, lift, compressor, valve, afterfire, contact, bell;
var localServer = Platform.resourceDir +/+ "scsynth";

if(File.exists(localServer)) { Score.program = localServer.quote };

makeEngine = { |stock|
SynthDef(if(stock) { \truenoEngine } { \tofuEngine }, { |firing=120, load=0.7, part=0, seed=23|
    var turns, firingPhase, wobble, pulses, primary, intakePorts, valveTrain;
    var paired, collector, tailpipe, pressureEdges, blowdownBody, muffler, mouth, exhaust;
    var airbox, plenum, intake, cams, crankcase, coast, output;
    var revs = ((firing - 32) / 188).clip(0, 1);
    var engineCycle = 4 / firing;
    RandSeed.ir(1, seed);

    // One turn here is 720 degrees. The crank accelerates a little after a
    // firing stroke, most noticeably at idle. Its mean rate stays exactly on
    // the tach and the ten-cycle pattern is common to every mic position.
    turns = Sweep.ar(0, firing * 0.25);
    firingPhase = turns * 2pi;
    wobble = (((firingPhase * 0.1 + 1.2).sin * 0.081)
        + ((firingPhase * 0.2 + 0.6).sin * 0.039)
        + ((firingPhase * 0.5 - 0.4).sin * 0.024)
        + ((firingPhase + 0.3).sin * 0.041)
        + ((firingPhase * 4).sin * 0.031)) * (1 - (revs * 0.54));

    // Firing order 1-3-4-2. Unequal primary lengths, cylinder filling and
    // pressure release leave four different signatures in each exhaust cycle.
    pulses = Array.fill(4, { |i|
        var phase, ignition, fuel, combustion, blowdown, rarefaction, flow, primaryGas;
        var opening, gulp, shut, port, intakeGas, lash, valve, facing, length;
        phase = (turns + (wobble * 0.25) - (i * 0.25) - [0, 0.0026, -0.0032, 0.0014][i]).frac;
        ignition = HPZ1.ar(phase) < 0;
        facing = [1.08, 0.80, 1.02, 0.91][i];
        fuel = Latch.ar((1 + (LFNoise2.ar(9 + i) * (0.19 - (revs * 0.09)))
            + (WhiteNoise.ar * (0.15 - (revs * 0.07)))), ignition);
        combustion = ignition * fuel * (1 + ((facing - 1) * (1 - (revs * 0.28))));
        blowdown = Decay2.ar(combustion, 0.00013 + (0.00016 * (1 - load)),
            (0.0012 + (0.21 / firing)) * [1.04, 0.88, 1.13, 0.95][i]);
        rarefaction = Decay2.ar(DelayC.ar(combustion, 0.03, 0.0009 + (0.075 / firing)),
            0.00076, 0.0018 + (0.24 / firing));
        flow = Decay2.ar(combustion, 0.00024, 0.001 + (0.50 / firing));
        primaryGas = (blowdown * 1.15) - (rarefaction * (0.72 + (0.16 * load)));
        primaryGas = primaryGas + (flow * (
            (BPF.ar(PinkNoise.ar, 690 + (load * 280), 1.12) * 1.75)
            + (BPF.ar(WhiteNoise.ar, 1640 + (revs * 360), 0.92) * (0.36 + (load * 0.42)))
            + (BPF.ar(WhiteNoise.ar, 3650, 1.05) * revs * load * 0.24)
        ));
        length = [0.00112, 0.00132, 0.00124, 0.00143][i];
        primaryGas = DelayC.ar(primaryGas, 0.01, length);

        // Each induction stroke opens into the plenum, draws air for part of
        // a revolution and closes with a sharper pressure wave at the port.
        opening = DelayC.ar(ignition, 0.10, engineCycle * 0.48);
        shut = DelayC.ar(opening, 0.05, engineCycle * [0.257, 0.248, 0.267, 0.254][i]);
        gulp = Decay2.ar(opening, 0.0004 + (0.10 / firing), 0.001 + (0.43 / firing));
        port = Decay2.ar(shut, 0.00017, 0.0007 + (0.14 / firing)) - (gulp * 0.67);
        intakeGas = ((port * (0.87 + (fuel * 0.17)))
            + (gulp * ((BPF.ar(PinkNoise.ar, 980, 1.2) * 2.3)
            + (BPF.ar(WhiteNoise.ar, 2680, 1.0) * 1.65))));
        intakeGas = DelayC.ar(intakeGas, 0.008, [0.0007, 0.0012, 0.0010, 0.0008][i]);

        // Exhaust and inlet valve seats produce two short, dry, irregular
        // contacts per head cycle. The metal carries their higher harmonics.
        lash = DelayC.ar(ignition, 0.09, engineCycle * 0.34) + (shut * 0.72);
        valve = Decay2.ar(lash, 0.00007, 0.0009 + (i * 0.00012))
            * (BPF.ar(WhiteNoise.ar, 2700 + (i * 240), 1.25) * 1.5);
        valve = valve + (Ringz.ar(lash, 1760 + (i * 156), 0.0026) * 0.17)
            + (Ringz.ar(lash, 3440 + (i * 193), 0.0017) * 0.081);
        [primaryGas, intakeGas, valve, ignition, combustion, shut];
    });
    primary = pulses.collect { |voice| voice[0] };
    intakePorts = pulses.collect { |voice| voice[1] }.sum;
    valveTrain = pulses.collect { |voice| voice[2] }.sum;

    // The paired header and the damped tailpipe return pressure with opposite
    // polarity. Fixed tube lengths put the harmonics through different peaks
    // as the driver climbs the rev range.
    paired = (primary[0] + primary[2]) + DelayC.ar(primary[1] + primary[3], 0.01, 0.00014);
    collector = paired - (LPF.ar(DelayC.ar(paired, 0.015, 0.00375), 2800) * 0.49)
        + (LPF.ar(DelayC.ar(paired, 0.019, 0.0071), 2050) * 0.29);
    tailpipe = collector + (LPF.ar(DelayC.ar(collector, 0.03, 0.0114), 1150) * 0.39);
    // Cylinder pressure also reaches the block and exhaust shell directly,
    // retaining the even-fire fundamental below the coloured header sound.
    pressureEdges = pulses.collect { |voice| voice[4] }.sum;
    blowdownBody = Ringz.ar(pressureEdges, firing * 1.07, 3.1 / firing);
    // The compact rear silencer has a strong upper-mid throat at idle.
    // Its effective opening and resonances change as exhaust mass flow rises.
    mouth = 595 - (load * (135 - (150 * revs)));
    muffler = (BPF.ar(collector, mouth, 0.29) * 2.6)
        + (Ringz.ar(pressureEdges, mouth, 0.036 - (0.014 * revs)) * 0.71)
        + (BPF.ar(tailpipe, mouth * 1.70, 0.51) * 0.58);
    muffler = muffler * (3.0 - (revs * 1.72));
    exhaust = (LPF.ar(tailpipe, 980 + (load * 2300) + (revs * 900)) * 0.60)
        + (BPF.ar(tailpipe, 138, 0.97) * (0.38 - (revs * 0.16)))
        + (BPF.ar(collector, 372, 1.04) * 0.58)
        + (BPF.ar(collector, 950 + (revs * 260), 0.88) * (0.34 + (revs * 0.42)))
        + (BPF.ar(collector, 2210, 0.82) * revs * 0.27)
        + (blowdownBody * (0.23 + (0.11 * revs))) + muffler;

    airbox = intakePorts - (DelayC.ar(intakePorts, 0.012, 0.0021) * 0.47)
        + (LPF.ar(DelayC.ar(intakePorts, 0.015, 0.0048), 2150) * 0.22);
    plenum = Ringz.ar(pulses.collect { |voice| voice[5] }.sum,
        305 + (revs * 112), 0.021);
    intake = (plenum * 0.45) + (BPF.ar(airbox, 410, 0.82) * 1.60)
        + (BPF.ar(airbox, 645 + (revs * 94), 0.66) * 1.48)
        + (BPF.ar(airbox, 1390 + (revs * 240), 0.72) * 0.65)
        + (BPF.ar(airbox, 2650, 0.80) * 0.35)
        + (HPF.ar(LPF.ar(airbox, 4200), 420) * 0.11);
    cams = LPF.ar(valveTrain, 7500);
    crankcase = pulses.collect { |voice, i|
        var impulse = DelayC.ar(voice[3], 0.018, (0.32 + (i * 0.012)) / firing);
        Ringz.ar(impulse, 199 + (i * 12), 0.0053) * (0.24 + (LFNoise2.ar(17) * 0.045))
        + (Ringz.ar(impulse, 784 + (i * 38), 0.0028) * 0.091);
    }.sum;
    // On a closed throttle the pumping/compression stroke and cam drive at
    // the front of the car carry on when the loaded exhaust has gone away.
    coast = (LPF.ar(tailpipe, 520) * 0.22) + (plenum * 0.21)
        + (BPF.ar(intakePorts, 380, 0.77) * 0.78)
        + (BPF.ar(intakePorts, 940, 0.75) * 0.19)
        + (BPF.ar(intakePorts, 1850, 0.83) * 0.08)
        + (crankcase * 0.95) + (cams * 0.15)
        + (BPF.ar(PinkNoise.ar, 1120, 1.05) * 0.032);
    output = Select.ar(part, [
        (exhaust * (0.64 + (load * 0.36)))
            + (crankcase * (0.80 - (load * 0.51)))
            + (cams * (0.58 - (load * 0.39)))
            + (intake * (0.08 + (revs * load * 0.36))),
        coast,
        intake + (cams * 0.10)
    ]);
    if(stock) {
        // Early big-port 4A-GEU. Each two-cylinder secondary reaches the
        // single exhaust at a different delay. The resonator and rear box
        // take the edge off the tail while the inlet opens under load.
        var branchA = primary[0] + primary[2], branchB = primary[1] + primary[3];
        var header = DelayC.ar(branchA, 0.01, 0.0015) + DelayC.ar(branchB, 0.01, 0.00196);
        var tube = header - (LPF.ar(DelayC.ar(header, 0.01, 0.0045), 2700) * 0.53);
        var rearBox = tube + (LPF.ar(DelayC.ar(tube, 0.02, 0.0102), 1450) * 0.43);
        var caseTone = (Ringz.ar(pressureEdges, 468, 0.012) * (0.46 - (revs * 0.19)))
            + (BPF.ar(rearBox, 305, 0.92) * 0.78) + (BPF.ar(rearBox, 843, 0.71) * 0.72);
        var tail = (LPF.ar(rearBox, 950 + (1950 * load) + (940 * revs)) * 0.79)
            + caseTone + (blowdownBody * 0.27) + (BPF.ar(tube, 1470, 0.86) * revs * 0.46);
        // A pressure pulse returns from the common plenum separately from
        // the high-port bark. Their mix follows the T-VIS actuator in game.
        var runner = intakePorts - (DelayC.ar(intakePorts, 0.01, 0.0033) * 0.48);
        var induction = (plenum * 0.56) + (BPF.ar(runner, 560, 0.79) * 1.9)
            + (BPF.ar(runner, 1030, 0.61) * 1.2) + (BPF.ar(runner, 1960, 0.72) * 1.05)
            + (BPF.ar(airbox, 3100, 0.94) * 0.36);
        var mechanical = (crankcase * 0.62) + (cams * 0.28);
        var closed = (LPF.ar(rearBox, 515) * 0.31) + (BPF.ar(runner, 515, 0.86) * 0.47)
            + (plenum * 0.24) + mechanical + (BPF.ar(airbox, 1220, 0.72) * 0.20);
        output = Select.ar(part, [
            tail + (mechanical * (1.28 - (load * 0.83))) + (induction * load * revs * 0.11),
            closed, induction + (cams * 0.08)
        ]);
    };
    // Leave room for the leading pressure edge. render.py matches stem RMS.
    Out.ar(0, LPF.ar(HPF.ar(output * 0.16, 26), 10800));
}) };
engine = makeEngine.value(false);
trueno = makeEngine.value(true);

// One render per induction/exhaust configuration. The common firing control
// is twice shaft speed. A two-rotor emits two port events per shaft turn;
// the flat four has four firings per 720 degrees and the RB26 has six.
makeRival = { |name, type|
    SynthDef(name, { |firing=120, load=0.8, part=0, seed=1|
        var rotary = type < 2, six = type == 3;
        var count = if(rotary, 2, if(six, 6, 4));
        var clock = if(rotary, firing/2, firing/4);
        var revs = ((firing-30)/195).clip(0,1), branches, pulses, edge, blowdown;
        var pipes, muffler, casing, intake, gas, exhaust, coast, layer, merged;
        var lengths = [
            [0.00115,0.00158], [0.00132,0.00230],
            [0.00135,0.00420,0.00150,0.00372],
            [0.00145,0.00178,0.00151,0.00173,0.00148,0.00182]
        ][type];
        var strengths = [[1,0.94],[1,0.86],[1,0.82,0.92,0.81],[1,0.95,0.98,0.97,0.99,0.96]][type];
        var resonator = [302,249,173,216][type], collector = [0.0031,0.0043,0.00615,0.0037][type];
        RandSeed.ir(1,seed);
        pulses = Array.fill(count,{ |i| Impulse.ar(clock,i/count) * strengths[i] });
        edge = pulses.sum;
        branches = pulses.collect { |p,i|
            var tick = DelayC.ar(p,0.012,lengths[i]);
            var flow = Decay2.ar(tick, if(rotary,0.00072,0.00027), if(rotary,0.0048,0.0039));
            var heat = BPF.ar(PinkNoise.ar, 1150+(load*820)+(revs*490), 0.91);
            (flow*(1+(heat*(0.46+(0.42*load))))) +
                (Ringz.ar(tick,resonator*(1+(0.018*i)),0.009)*0.33)
        };
        blowdown = branches.sum;
        pipes = blowdown - (DelayC.ar(blowdown,0.015,collector)*(0.65-(load*0.14)));
        merged = if(rotary, {
            // Broad peripheral-port exhaust followed by the turbine housing.
            var second = if(type==0, revs.linlin(0.50,0.64,0,1).clip(0,1), 0);
            (pipes * 0.76) + (BPF.ar(pipes,635+(revs*135),0.68)*1.7)
            + (BPF.ar(pipes,1390+(550*second),0.66)*(0.64+(0.58*load)))
            + (Ringz.ar(edge,if(type==0,2630,1960),0.0016)*revs*0.27)
        }, {
            // Separate turbine/manifold arrivals on the 1-5-3-6-2-4 six,
            // or unequal-length left/right primaries on the Subaru.
            var odd = branches.select { |v,i| i.odd }.sum;
            var even = branches.select { |v,i| i.even }.sum;
            var pair = even + DelayC.ar(odd,0.012,if(six,0.0005,0.0024));
            (pipes*0.45) + pair + (BPF.ar(pair,if(six,820,358),0.68)*1.32)
            + (BPF.ar(pair,if(six,1760,863),0.58)*(0.43+(load*0.45)))
        });
        muffler = merged + (LPF.ar(DelayC.ar(merged,0.022,collector*2.6),1450)*0.37);
        casing = Ringz.ar(edge, [731,618,489,896][type],0.0031)*0.17;
        gas = Decay2.ar(edge,0.0009,0.0058) * PinkNoise.ar;
        intake = (BPF.ar(blowdown, [515,441,394,638][type],0.79)*3.5)
            + (BPF.ar(gas,1300+(revs*810),0.85)*1.6)
            + (BPF.ar(pipes,2180+(revs*1040),0.71)*1.1) + (casing*0.32);
        exhaust = LPF.ar(muffler, 1720+(load*2750)+(revs*2100)) + casing*(1.08-(load*0.42));
        coast = LPF.ar(muffler, 560+(revs*420))*0.50 + (intake*0.25) + (casing*0.76);
        layer = Select.ar(part,[exhaust,coast,intake]);
        Out.ar(0,LPF.ar(HPF.ar(layer,if(six,31,28)),10400)*0.18);
    })
};
rivals = ["fd3s","fc3s","gc8","bnr32"];

tires = SynthDef(\tofuTires, { |part=0, seed=64|
    var sand, shake, chatter, strain, grain, low, tearing, voiceA, voiceB, squeal;
    var adhesion, tread, front, locked;
    RandSeed.ir(1, seed);
    sand = PinkNoise.ar + (WhiteNoise.ar * 0.16);
    shake = LFNoise2.ar(3.4) * 0.065 + (LFNoise2.ar(14) * 0.018);
    chatter = LFTri.ar(36 + (LFNoise2.ar(7) * 12)).range(0.77, 1);
    strain = 1 + shake + (SinOsc.ar(8.2, 0, 0.009));
    grain = Decay2.ar(Dust2.ar(470), 0.00035, 0.0049);
    low = BPF.ar(sand, 560 * strain, 0.88) + (BPF.ar(sand, 1010 * strain, 0.69) * 0.69);
    tearing = (low * 1.12) + (BPF.ar(grain, 1590, 0.85) * 0.50) + (BPF.ar(sand, 2550, 0.75) * 0.47);
    // Two contact-patch modes wander independently and occasionally lock.
    // The broad granular bed can be mixed alone at the edge of adhesion.
    voiceA = SinOsc.ar(1035 * strain, SinOsc.ar(68 + (shake * 45), 0, 0.49) + (sand * 0.28));
    voiceB = SinOsc.ar(1580 * (1 + (LFNoise2.ar(4.8) * 0.053) + (shake * 0.54)),
        SinOsc.ar(31, 0, 0.58));
    adhesion = LFNoise2.ar(3.8).range(0.25, 0.94);
    tread = (BPF.ar(sand, 2330 * strain, 0.38) * 0.47) + (BPF.ar(grain, 2940, 0.61) * 0.23);
    squeal = (voiceA * (0.37 + (adhesion * 0.19)))
        + (voiceB * (0.18 + ((1 - adhesion) * 0.23)))
        + (SinOsc.ar(2220 * strain, voiceA * 0.39) * 0.079) + (tearing * 0.86) + tread;
    // The loaded outside front develops a thin high chirr before the rear
    // locks. A stationary tread dragged across asphalt is lower and broader.
    front = (BPF.ar(sand, 1630 * strain, 0.38) * 0.94) + (tread * 0.90)
        + (SinOsc.ar(1410 * strain, SinOsc.ar(97, 0, 0.65)) * (0.17 + (adhesion * 0.12)))
        + (SinOsc.ar(2359 * (1 + (shake * 0.70)), sand * 0.48) * 0.12);
    locked = (tearing * 1.7) + (BPF.ar(sand, 736 * strain, 0.26) * 1.5)
        + (LFTri.ar(698 * strain, 0, 0.22) * chatter) + (BPF.ar(grain, 1150, 0.53) * 1.3);
    Out.ar(0, HPF.ar(Select.ar(part, [tearing * chatter, squeal * chatter, front * chatter,
        locked * LFNoise2.ar(23).range(0.57, 1)]).softclip, 205));
});

compressor = SynthDef(\tofuCompressor, {
    var turbulence, wander, blade, whistle, air;
    RandSeed.ir(1, 106);
    turbulence = PinkNoise.ar + (WhiteNoise.ar * 0.27);
    wander = 1 + (LFNoise2.ar(11) * 0.004) + (LFNoise2.ar(3.8) * 0.010);
    // Turbulent flow through the inlet excites a narrow whistle. Only a
    // little coherent blade-passing tone escapes the airbox.
    blade = SinOsc.ar(1640 * wander, LPF.ar(WhiteNoise.ar, 90) * 0.35)
        * LFNoise2.ar(5.6).range(0.023, 0.048);
    whistle = BPF.ar(WhiteNoise.ar, 1730 * wander, 0.042) * 0.60;
    air = (BPF.ar(turbulence, 1540, 0.97) * 0.88)
        + (BPF.ar(turbulence, 2975, 0.79) * 0.40) + (BPF.ar(turbulence, 4610, 0.81) * 0.070);
    Out.ar(0, HPF.ar(air + whistle + blade, 555));
});

valve = SynthDef(\tofuBypassValve, {
    var pressure, throat, noise, hiss, ring, flutter;
    RandSeed.ir(1, 129);
    pressure = EnvGen.ar(Env([0, 1, 0.58, 0.18, 0], [0.005, 0.061, 0.125, 0.19], [1, -2, -1.5, -4]));
    throat = XLine.ar(3360, 920, 0.31) * (1 + (LFNoise2.ar(34) * 0.031));
    noise = WhiteNoise.ar * 0.50 + PinkNoise.ar;
    flutter = 0.83 + (SinOsc.ar(XLine.ar(30, 14, 0.23)) * 0.17);
    hiss = BPF.ar(noise, throat, 0.62) * 1.6 + BPF.ar(noise, throat * 1.65, 0.84);
    ring = SinOsc.ar(throat * 0.62, noise * 0.15) * pressure.squared * 0.09;
    Out.ar(0, HPF.ar(((hiss * flutter) + ring) * pressure, 460));
});

afterfire = SynthDef(\tofuTailpipePop, {
    var edge, gas, body, shell, outlet;
    RandSeed.ir(1, 148);
    edge = Impulse.ar(0);
    gas = EnvGen.ar(Env.perc(0.0003, 0.054, 1, -5.5)) *
        (BPF.ar(PinkNoise.ar, XLine.ar(1980, 660, 0.05), 1.35) * 2.3 + (WhiteNoise.ar * 0.30));
    body = SinOsc.ar(XLine.ar(164, 65, 0.058)) * EnvGen.ar(Env.perc(0.0009, 0.112, 1, -5));
    shell = Ringz.ar(edge, 262, 0.041) * 0.31 + (Ringz.ar(edge, 471, 0.020) * 0.17);
    outlet = (gas * 0.91) + (body * 0.69) + shell;
    Out.ar(0, HPF.ar((outlet - (LPF.ar(DelayC.ar(outlet, 0.025, 0.0112), 1520) * 0.37)).softclip, 46));
});

lift = SynthDef(\tofuLift, {
    var onset, puffs, exhaust, envelope, gas, packing;
    RandSeed.ir(1, 31);
    onset = Impulse.ar(0);
    puffs = onset + (DelayN.ar(onset, 0.11, 0.041) * 0.55)
        + (DelayN.ar(onset, 0.18, 0.117) * 0.22);
    envelope = Decay2.ar(puffs, 0.00095, 0.016);
    gas = (BPF.ar(BrownNoise.ar, 206, 1.15) * 3.8)
        + (BPF.ar(PinkNoise.ar, 635, 0.98) * 2.4)
        + (BPF.ar(WhiteNoise.ar, 1310, 0.85) * 1.05);
    exhaust = (Ringz.ar(puffs, 115, 0.046) * 0.34)
        + (Ringz.ar(puffs, 237, 0.026) * 0.26) + (envelope * gas * 1.7);
    packing = LPF.ar(DelayC.ar(exhaust, 0.025, 0.014), 980);
    Out.ar(0, HPF.ar((exhaust - (packing * 0.39)) * 0.46, 55));
});

air = SynthDef(\tofuAir, {
    var wash, road;
    RandSeed.ir(1, 93);
    wash = PinkNoise.ar;
    road = (BPF.ar(wash, 310, 0.83) * 1.1)
        + (BPF.ar(wash, 1200, 0.74) * 0.61)
        + (BPF.ar(wash, 4200, 0.55) * 0.24);
    Out.ar(0, HPF.ar(road * (0.87 + (LFNoise2.ar(4) * 0.08)), 82));
});

shifter = SynthDef(\tofuShift, {
    var onset, disengage, latch, seat, movement, housing;
    RandSeed.ir(1, 21);
    onset = Impulse.ar(0);
    disengage = Decay2.ar(onset, 0.0009, 0.007);
    latch = DelayN.ar(onset, 0.06, 0.039);
    seat = Decay2.ar(latch, 0.00016, 0.0098);
    movement = (BPF.ar(PinkNoise.ar, 720, 1.2) * disengage * 3)
        + (BPF.ar(WhiteNoise.ar, 1650, 0.80) * seat * 1.42)
        + (BPF.ar(WhiteNoise.ar, 3380, 1.03) * seat * 0.40);
    housing = (Ringz.ar(latch + (onset * 0.25), 148, 0.031) * 0.40)
        + (Ringz.ar(latch, 364, 0.012) * 0.22)
        + (Ringz.ar(latch, 1050, 0.0053) * 0.13);
    Out.ar(0, HPF.ar(movement + housing, 63) * 0.57);
});

contact = SynthDef(\tofuContact, {
    var metal, bang, slide, thud, flecks;
    RandSeed.ir(1, 39);
    bang = EnvGen.ar(Env.perc(0.0005, 0.17, 1, -6));
    metal = Ringz.ar(WhiteNoise.ar * bang * 0.033,
        [195, 440, 791, 1652], [0.17, 0.11, 0.085, 0.046], [1.0, 0.55, 0.3, 0.14]).sum;
    slide = BPF.ar(PinkNoise.ar, XLine.ar(2150, 690, 0.25), 0.83)
        * EnvGen.ar(Env.perc(0.003, 0.29, 1, -3.7));
    thud = SinOsc.ar(XLine.ar(154, 46, 0.085)) * bang;
    flecks = Decay2.ar(Dust.ar(80), 0.001, 0.006)
        * HPF.ar(WhiteNoise.ar, 2400) * EnvGen.ar(Env.perc(0.006, 0.28));
    Out.ar(0, ((thud * 0.83) + metal + (slide * 1.2) + (flecks * 0.2)).softclip * 0.85);
});

bell = SynthDef(\tofuBell, { |freq=760, amp=0.38, duration=0.28|
    var env, strike, overtone, tone;
    env = EnvGen.ar(Env.perc(0.002, duration, 1, -5));
    strike = EnvGen.ar(Env.perc(0.001, 0.034, 1, -7));
    overtone = SinOsc.ar(freq * 2.001, 0, 0.18) + SinOsc.ar(freq * 3.98, 0, 0.09);
    tone = (SinOsc.ar(freq, 0, 0.86) + overtone) * env
        + (SinOsc.ar(freq * 5.61) * strike * 0.10);
    Out.ar(0, tone * amp);
});

// The engine, tire and air clips run continuously. render.py removes pre-roll
// and joins the matching ends. Cue recipes use time in seconds from onset.
recipes = [
    ["engine-idle", 5.35, engine, [[0, [\firing, 32, \load, 0.10, \seed, 33]]]],
    ["engine-low", 4.10, engine, [[0, [\firing, 80, \load, 0.80, \seed, 38]]]],
    ["engine-drive", 4.10, engine, [[0, [\firing, 120, \load, 0.92, \seed, 34]]]],
    ["engine-high", 4.60, engine, [[0, [\firing, 220, \load, 1, \seed, 35]]]],
    ["engine-coast", 4.10, engine, [[0, [\firing, 120, \load, 0.10, \part, 1, \seed, 36]]]],
    ["engine-intake", 4.65, engine, [[0, [\firing, 180, \load, 1, \part, 2, \seed, 37]]]],
    ["tire-scrub", 3.70, tires, [[0, [\part, 0, \seed, 64]]]],
    ["tire-squeal", 3.70, tires, [[0, [\part, 1, \seed, 75]]]],
    ["tire-front", 3.70, tires, [[0, [\part, 2, \seed, 76]]]],
    ["tire-lock", 3.70, tires, [[0, [\part, 3, \seed, 77]]]],
    ["turbo-spool", 3.82, compressor, [[0, []]]],
    ["blowoff", 0.44, valve, [[0, []]]],
    ["afterfire", 0.23, afterfire, [[0, []]]],
    ["road-air", 3.36, air, [[0, []]]],
    ["overrun", 0.27, lift, [[0, []]]],
    ["shift", 0.18, shifter, [[0, []]]],
    ["impact", 0.40, contact, [[0, []]]],
    ["checkpoint", 0.49, bell, [[0, [\freq, 932.33, \duration, 0.19]], [0.083, [\freq, 1244.51, \duration, 0.31]]]],
    ["go", 0.48, bell, [[0, [\freq, 1046.5, \duration, 0.36, \amp, 0.30]], [0, [\freq, 1567.98, \duration, 0.32, \amp, 0.15]]]],
    ["finish", 0.98, bell, [[0, [\freq, 783.99, \duration, 0.23]], [0.096, [\freq, 932.33, \duration, 0.22]], [0.20, [\freq, 1046.5, \duration, 0.23]],
        [0.32, [\freq, 1396.91, \duration, 0.52, \amp, 0.34]], [0.32, [\freq, 1046.5, \duration, 0.42, \amp, 0.16]]]]
];
// Both cars use the same sampled crank speeds for phase-locked pitch ramps.
// The Trueno renders through its own manifold, induction and silencer.
recipes = recipes ++ recipes.select { |entry| entry[0].beginsWith("engine-") }.collect { |entry|
    [entry[0].replace("engine-", "trueno-"), entry[1], trueno, entry[3]]
};

rivals.do { |id, i|
    var def = makeRival.value(id.asSymbol,i);
    recipes = recipes ++ recipes.select { |entry| entry[0].beginsWith("engine-") }.collect { |entry|
        [entry[0].replace("engine-", id ++ "-"), entry[1], def, entry[3]]
    };
};
if("TOFU_SFX_RIVALS".getenv == "1") {
    recipes = recipes.select { |entry| rivals.any { |id| entry[0].beginsWith(id ++ "-") } };
};
if("TOFU_SFX_ENGINE_ONLY".getenv == "1") {
    recipes = recipes.select { |entry|
        (entry[0].beginsWith("engine-")) or: { (entry[0] == "shift") or: { entry[0] == "overrun" } }
    };
};
if("TOFU_SFX_TURBO_TIRES".getenv == "1") {
    recipes = recipes.select { |entry| entry[0].beginsWith("tire-") or: {
        ["turbo-spool", "blowoff", "afterfire"].includesEqual(entry[0]) } };
};
if("TOFU_SFX_TRUENO".getenv == "1") {
    recipes = recipes.select { |entry| entry[0].beginsWith("trueno-") };
};
if(("TOFU_SFX_ONLY".getenv ? "").size > 0) {
    recipes = recipes.select { |entry| entry[0] == "TOFU_SFX_ONLY".getenv };
};

render = { |index|
    if(index >= recipes.size) {
        "Tofu Touge SFX renders complete".postln;
        0.exit;
    } {
        var entry = recipes[index], name = entry[0], def = entry[2];
        var commands = List[[0, [\d_recv, def.asBytes]]];
        entry[3].do { |layer, i|
            commands.add([0.008 + layer[0], [\s_new, def.name, 1000 + i, 0, 1] ++ layer[1]]);
        };
        Score(commands.asArray).recordNRT(
            oscFilePath: output +/+ (name ++ ".osc"),
            outputFilePath: output +/+ (name ++ ".wav"),
            sampleRate: 32000, headerFormat: "WAV", sampleFormat: "int16",
            options: options, duration: entry[1],
            action: { |code| { if(code != 0) { code.exit } { render.value(index + 1) } }.defer }
        );
    };
};
render.value(0);
)
