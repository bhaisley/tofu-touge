"""Bake the Mikuni horizons from NASA SRTMGL1 elevations (N35E138 and N35E139).

Pass a directory containing the two SRTMGL1 .hgt.zip files or unzipped .hgt files.
The original 1 arc-second tiles are available at https://step.esa.int/auxdata/dem/SRTMGL1/.
The bake needs NumPy and Pillow. Each atlas holds an opaque distant panorama
above a cutout of the nearby terrain, with previously hidden scenery behind it.
"""
from argparse import ArgumentParser
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image

PROJECT = Path(__file__).resolve().parents[1]
ART = PROJECT / "dist/assets/art"
LAT, LON, EYE = 35.4126, 138.9094, 1094.
DEG = np.pi / 180
EAST = 111320 * np.cos(LAT * DEG)
NORTH = 110940
# Atlas layout shared with dist/js/fuji.js, from the top of the image.
FAR_BOTTOM, FAR_TOP = -8., 62.
NEAR_BOTTOM, NEAR_TOP = -21., 19.


def read_tile(folder, name):
    raw = folder / (name + ".hgt")
    if raw.exists():
        data = raw.read_bytes()
    else:
        archive = next(folder.glob(name + "*.zip"))
        with ZipFile(archive) as z:
            data = z.read(next(path for path in z.namelist() if path.endswith(".hgt")))
    return np.frombuffer(data, dtype=">i2").reshape(3601, 3601)


class Terrain:
    def __init__(self, folder):
        self.tiles = np.concatenate((read_tile(folder, "N35E138")[:, :-1], read_tile(folder, "N35E139")), axis=1)

    def __call__(self, x, z):
        # East is +x, south is +z, as in the driving world.
        i = np.clip((LON - 138 + x / EAST) * 3600, 0, 7199.99)
        j = np.clip((36 - LAT + z / NORTH) * 3600, 0, 3599.99)
        a, b = i.astype(int), j.astype(int)
        dx, dz = i - a, j - b
        def tap(da, db):
            return np.maximum(0, self.tiles[b + db, a + da])
        return (tap(0, 0) * (1-dx) + tap(1, 0) * dx) * (1-dz) + (tap(0, 1) * (1-dx) + tap(1, 1) * dx) * dz


def mix(a, b, t):
    return a * (1 - t) + b * t


def smooth(a, b, x):
    t = np.clip((x-a)/(b-a), 0, 1)
    return t*t*(3-2*t)


def noise(x, y, period):
    a, b = np.floor(x/period), np.floor(y/period)
    u, v = x/period-a, y/period-b
    u, v = u*u*(3-2*u), v*v*(3-2*v)
    def hash_at(dx, dy):
        h = np.sin((a+dx)*127.1 + (b+dy)*311.7) * 43758.5453
        return h - np.floor(h)
    return mix(mix(hash_at(0, 0), hash_at(1, 0), u), mix(hash_at(0, 1), hash_at(1, 1), u), v)


def background(w, elevations, blue):
    h = len(elevations)
    az = np.broadcast_to(np.arange(w)[None, :] * 360 / w, (h, w))
    alt = np.broadcast_to(elevations[:, None], (h,w))
    sun = 100 if blue else 238
    elevation = -4.5 if blue else 14.1
    ang = (az - sun + 180) % 360 - 180
    solar = np.exp(-(ang/58)**2)
    depth = np.exp(-np.maximum(0,alt)/(23 if blue else 18))
    horizon = mix(np.array([.57,.64,.75]) if blue else np.array([.72,.78,.78]),
                  np.array([.98,.68,.57]) if blue else np.array([1.,.83,.59]), solar[...,None])
    zenith = np.array([.17,.24,.40]) if blue else np.array([.31,.49,.66])
    if blue:
        # The Belt of Venus sits opposite the sun, above the earth-shadow band.
        horizon += (np.exp(-(.12*(alt-7.5))**2)*np.exp(-((np.abs(ang)-180)/95)**2))[...,None]*[.13,.019,.026]
    sky = mix(zenith, horizon, depth[...,None])
    # Only cloud structure above the Haruna horizon is reused. Both solar
    # positions, atmospheric gradients and the terrain underneath are local.
    source = np.asarray(Image.open(ART/"haruna-sky.webp").convert("RGB"),dtype=float)/255
    sy, sx = source.shape[:2]
    px = (w * .73 + (az - sun) * w / 360) / w
    py = .526-np.clip((alt - 3) / 80,0,.515)
    ix, iy = (np.mod(px,1)*sx).astype(int)%sx, np.clip((py*sy).astype(int),0,sy-1)
    cloud = source[iy,ix]
    lum = cloud@np.array([.26,.57,.17])
    structure = (lum-.56)*.85 + (cloud[:,:,0]-cloud[:,:,2])*.43
    band = smooth(1,8,alt) * (1-smooth(43,70,alt))
    cloud_shadow = (np.maximum(0,-structure)*band)[...,None]
    cloud_light = (np.maximum(0,structure)*band)[...,None]
    sky += cloud_light*(np.array([.41,.30,.24]) if blue else np.array([.57,.49,.43]))
    sky -= cloud_shadow*(np.array([.45,.31,.27]) if blue else np.array([.47,.43,.34]))
    if not blue:
        r = np.hypot(ang*np.cos(elevation*DEG), alt-elevation)
        sky += np.exp(-r/3.2)[...,None]*[.31,.21,.07]
        sky = mix(sky,np.array([1.,.991,.914]),(1-smooth(.20,.34,r))[...,None])
    return np.clip(sky,0,1).astype(np.float32)


def render_band(dem, width, height, bottom, top, ranges, near):
    elevations = top - (np.arange(height) + .5) * (top - bottom) / height
    fields = [np.zeros((height,width,3),dtype=np.float32) if near else background(width,elevations,blue)
              for blue in (False,True)]
    alpha = np.full((height,width),255,dtype=np.uint8)
    for start in range(0,width,96):
        end = min(start+96,width)
        az = np.arange(start,end)*2*np.pi/width
        vx,vz = np.sin(az), -np.cos(az)
        r = ranges[:,None]
        h = dem(r*vx,r*vz)
        # Raycast each distance band independently. This also paints the
        # slopes and sky revealed when the near ridge shifts with the camera.
        angles = np.arctan2(h - EYE - r*r/14800000, r)/DEG
        envelope = np.maximum.accumulate(angles,axis=0)
        ids = np.array([np.searchsorted(col,elevations,side="left") for col in envelope.T]).T
        seen = ids<len(ranges)
        hi = np.minimum(ids,len(ranges)-1)
        lo = np.maximum(hi-1,0)
        col = np.arange(end-start)[None,:]
        hi_alt,lo_alt = angles[hi,col],angles[lo,col]
        t = np.clip((elevations[:,None]-lo_alt)/np.maximum(.0001,hi_alt-lo_alt),0,1)
        dist = mix(ranges[lo],ranges[hi],t)
        x,z = dist*vx,dist*vz
        a = dem(x,z)
        dx = (dem(x+37,z)-dem(x-37,z))/74
        dz = (dem(x,z+37)-dem(x,z-37))/74
        convex = a-.25*(dem(x+110,z)+dem(x-110,z)+dem(x,z+110)+dem(x,z-110))
        macro,mid,micro = noise(x,z,180),noise(x+916,z,57),noise(x,z-281,17)
        loam = .52*macro+.33*mid+.15*micro
        radial = np.hypot(x-(138.7273-LON)*EAST,z-(LAT-35.3607)*NORTH)
        normal = np.sqrt(1+dx*dx+dz*dz)
        lake = (np.abs(a-984)<.8)&(abs(dx)+abs(dz)<.028)&(x<-730)&(x>-7460)&(z<1470)&(z>-3400)
        snowline = 2520 + 123*dx - 142*dz + 390*(macro-.5) + 175*(mid-.5) + np.clip(convex*14,-380,480)
        snow = smooth(snowline,snowline+120+75*mid,a)*(1-smooth(12600,14800,radial))
        scoria=smooth(1730,2590,a)*(1-smooth(11000,15200,radial))
        if near:
            alpha[:,start:end] = seen.astype(np.uint8) * 255
        for k,field in enumerate(fields):
            blue = (k==1)
            direction=np.array([.806,.22,.55]) if blue else np.array([-.825,.244,.512])
            facing = (-dx*direction[0]+direction[1]-dz*direction[2])/normal
            light = np.clip(.40+.96*facing,.13,1)
            detail = np.clip(.44+.81*loam-.10*dz+.003*convex,.27,1.14)
            wood = mix(np.array([.12,.166,.146]),np.array([.354,.365,.278]),detail[...,None])
            wood+= (np.maximum(0,macro-.46)*(.5+mid))[...,None]*[.11,.049,-.056]
            ash = mix(np.array([.29,.27,.27]),np.array([.46,.414,.398]),loam[...,None])
            base = mix(wood,ash,scoria[...,None])
            rocky=base*((.59+.64*light)*(1+.16*(micro-.5)))[...,None]
            ice = mix(np.array([.57,.63,.71]) if blue else np.array([.65,.68,.707]),
                      np.array([.97,.76,.77]) if blue else np.array([.96,.90,.80]),light[...,None])
            ice*=np.clip(.93+.05*mid+.015*convex+.032*(micro-.5),.62,1.04)[...,None]
            land=mix(rocky,ice,snow[...,None])
            if blue:
                land=mix(land*np.array([.68,.73,.85]),ice,snow[...,None]*.66)
            # Lowland roof glints fade into the small fields around the shore.
            town=(1-smooth(0,36,abs(a-1003)))*(1-smooth(.06,.21,np.abs(dx)+np.abs(dz)))
            roof=town*smooth(.57,.88,micro)*smooth(.42,.68,mid)*(1-smooth(8000,12500,dist))
            land+=roof[...,None]*([.14,.13,.105] if not blue else [.10,.075,.055])
            haze=(1-np.exp(-dist/(31000 if not blue else 38500)))*.83
            haze_color=np.array([.55,.61,.69]) if not blue else np.array([.41,.46,.60])
            land=mix(land,haze_color,haze[...,None])
            water=mix(np.array([.34,.48,.50]) if not blue else np.array([.28,.37,.48]),
                      np.array([.66,.71,.69]) if not blue else np.array([.53,.57,.68]),(.22+.43*loam)[...,None])
            ripple=(.5-noise(x*.37,z,12))*.041 + .015*np.sin((z+x*.33)*.17+5*macro)
            land=np.where(lake[...,None],water+ripple[...,None],land)
            pane=field[:,start:end]
            pane[seen]=np.clip(land[seen],0,1)
    return [np.dstack((np.clip(np.rint(field*255),0,255).astype(np.uint8),alpha)) for field in fields]


def bake(dem, width, height, folder):
    if height % 8:
        raise ValueError("The atlas height must be divisible by eight.")
    near_height = height * 3 // 8
    # The break lies past Lake Yamanaka and in front of Fuji. Start the near
    # rays below the survey eye so low views sample the actual hillside.
    near_ranges = np.r_[np.arange(8,162,3),np.arange(162,810,8),np.arange(810,6500,16),6500.]
    far_ranges = np.r_[np.arange(6500,9200,16),np.arange(9200,24001,22),np.arange(24050,50001,63)]
    far = render_band(dem,width,height-near_height,FAR_BOTTOM,FAR_TOP,far_ranges,False)
    near = render_band(dem,width,near_height,NEAR_BOTTOM,NEAR_TOP,near_ranges,True)
    for k,stem in enumerate(("mikuni-afternoon-horizon","mikuni-blue-hour-horizon")):
        img = np.concatenate((far[k],near[k]),axis=0)
        dest=folder/(stem+".webp")
        Image.fromarray(img).save(dest,quality=90,method=6,exact=True)
        print(stem, dest.stat().st_size,flush=True)


if __name__=="__main__":
    parser=ArgumentParser(description=__doc__)
    parser.add_argument("tiles",type=Path)
    parser.add_argument("--out",type=Path,default=ART)
    parser.add_argument("--width",type=int,default=4096)
    parser.add_argument("--height",type=int,default=1024)
    args=parser.parse_args()
    bake(Terrain(args.tiles),args.width,args.height,args.out)
