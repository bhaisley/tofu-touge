"""Bake the Mikuni horizons from NASA SRTMGL1 elevations (N35E138 and N35E139).

Pass a directory containing the two SRTMGL1 .hgt.zip files or unzipped .hgt files.
The original 1 arc-second tiles are available at https://step.esa.int/auxdata/dem/SRTMGL1/.
The bake needs NumPy and Pillow. Each atlas holds the sky and two independent
terrain layers. A second atlas holds the view reflected in Lake Yamanaka and
the visible shoreline for both times of day.
"""
from argparse import ArgumentParser
from pathlib import Path
from zipfile import ZipFile

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PROJECT = Path(__file__).resolve().parents[1]
ART = PROJECT / "dist/assets/art"
LAT, LON, EYE = 35.4126, 138.9094, 1094.
DEG = np.pi / 180
EAST = 111320 * np.cos(LAT * DEG)
NORTH = 110940
# Atlas layout shared with dist/js/fuji.js. The highest far summit is 8.8°
# and the nearest ridge reaches 14.8° from the survey point.
FUJI_BEARING = 251.
FAR_BOTTOM, FAR_TOP = -3., 11.
LAKE_LEVEL = 984.
LAKE_WEST, LAKE_SPAN, MIRROR_TOP = 256., 80., 12.


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


def background(bearings, elevations, blue, source):
    az = bearings[None, :] * 360
    alt = elevations[:, None]
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
        horizon = horizon + (np.exp(-(.12*(alt-7.5))**2)*np.exp(-((np.abs(ang)-180)/95)**2))[...,None]*[.13,.019,.026]
    sky = mix(zenith, horizon, depth[...,None])
    # Only cloud structure above the Haruna horizon is reused. Both solar
    # positions, atmospheric gradients and the terrain underneath are local.
    sy, sx = source.shape[:2]
    px = np.mod(.73 + (az-sun)/360, 1)*sx-.5
    py = np.clip((.526-np.clip((alt-3)/80,0,.515))*sy-.5,0,sy-1)
    ix, iy = np.floor(px).astype(int), np.floor(py).astype(int)
    fx, fy = (px-ix)[...,None], (py-iy)[...,None]
    def sample_row(y):
        return mix(source[y,ix%sx], source[y,(ix+1)%sx], fx)
    cloud = mix(sample_row(iy),sample_row(np.minimum(iy+1,sy-1)),fy)
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


def sky_band(width, height, blue, source):
    # Fold the full-height sky into two side-by-side rectangles. Repeat the
    # photograph into the gutters so filtering crosses the longitude and fold.
    tile_width = width//2
    u = ((np.arange(tile_width)+.5)/width-1/1024) / (.5-2/1024)
    v = ((height-np.arange(height)-.5)/(4*height)-1/256) / (.25-2/256)
    strips = [background(u,-8+35*(v+i),blue,source) for i in (0,1)]
    rgb = np.concatenate(strips,axis=1)
    return np.dstack((np.rint(rgb*255).astype(np.uint8),np.full((height,width),255,np.uint8)))


def land_colors(dem, x, z, dist):
    a = dem(x,z)
    dx = (dem(x+37,z)-dem(x-37,z))/74
    dz = (dem(x,z+37)-dem(x,z-37))/74
    convex = a-.25*(dem(x+110,z)+dem(x-110,z)+dem(x,z+110)+dem(x,z-110))
    macro,mid,micro = noise(x,z,180),noise(x+916,z,57),noise(x,z-281,17)
    loam = .52*macro+.33*mid+.15*micro
    radial = np.hypot(x-(138.7273-LON)*EAST,z-(LAT-35.3607)*NORTH)
    normal = np.sqrt(1+dx*dx+dz*dz)
    snowline = 2520 + 123*dx - 142*dz + 390*(macro-.5) + 175*(mid-.5) + np.clip(convex*14,-380,480)
    snow = smooth(snowline,snowline+120+75*mid,a)*(1-smooth(12600,14800,radial))
    scoria=smooth(1730,2590,a)*(1-smooth(11000,15200,radial))
    for blue in (False, True):
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
        yield land


def render_band(dem, width, height, ranges, near):
    # Four terrain rays per output texel filter snow and woodland at
    # their angular footprint before the texture is compressed.
    u = (np.arange(2*width)+.5)/(2*width)
    v = 1-(np.arange(2*height)+.5)/(2*height)
    if near:
        bearings = u*360
        elevations = np.interp(v,[0,.20,1],[-21,-5,17])
    else:
        # Reserve 30% of the far layer for the 30° surrounding Fuji. The
        # complete circle still wraps at the bearing opposite the mountain.
        bearings = FUJI_BEARING + np.interp(u,[0,.35,.65,1],[-180,-15,15,180])
        elevations = mix(FAR_BOTTOM,FAR_TOP,v)
    fields = [np.empty((height,width,4),np.uint8) for _ in range(2)]
    for start in range(0,2*width,128):
        end = min(start+128,2*width)
        az = bearings[start:end]*DEG
        vx,vz = np.sin(az), -np.cos(az)
        r = ranges[:,None]
        h = dem(r*vx,r*vz)
        # Raycast each distance band independently. This also paints the
        # slopes and sky revealed when the near ridge shifts with the camera.
        angles = np.arctan2(h - EYE - r*r/14800000, r)/DEG
        envelope = np.maximum.accumulate(angles,axis=0)
        crest = envelope[-1]
        # Extend the true crest colour into the filter footprint above it.
        # Coverage is reconstructed separately at the player's pixel scale.
        elevation = np.minimum(elevations[:,None],crest)
        hi = np.stack([np.searchsorted(col,el,side="left")
                       for col,el in zip(envelope.T,elevation.T)],axis=1)
        lo = np.maximum(hi-1,0)
        col = np.arange(end-start)[None,:]
        hi_alt,lo_alt = angles[hi,col],angles[lo,col]
        t = np.clip((elevation-lo_alt)/np.maximum(.0001,hi_alt-lo_alt),0,1)
        dist = mix(ranges[lo],ranges[hi],t)
        x,z = dist*vx,dist*vz
        # The 192 contour is the exact surveyed skyline. Even air keeps a
        # nonzero alpha so browser image decoders preserve its edge colour.
        distance = crest-elevations[:,None]
        tile = (height,2,(end-start)//2,2)
        mask = np.rint((192+np.clip(distance*192,-64,63)).reshape(tile).mean(axis=(1,3)))
        for field,land in zip(fields,land_colors(dem,x,z,dist)):
            pane = field[:,start//2:end//2]
            pane[:,:,:3] = np.rint(np.clip(land,0,1).reshape(*tile,3).mean(axis=(1,3))*255)
            pane[:,:,3] = mask
    return fields


class LakeShore:
    """Connected, level SRTM water cells. Keep nearby flat fields on land."""
    def __init__(self, dem):
        self.x0, self.z0, self.step = -7500., -3500., 12.
        x,z = np.meshgrid(np.arange(self.x0,-600,self.step),np.arange(self.z0,1600,self.step))
        flat = (abs(dem(x,z)-LAKE_LEVEL)<.75) & (abs(dem(x+24,z)-dem(x-24,z))+abs(dem(x,z+24)-dem(x,z-24))<1.4)
        image = Image.fromarray(flat.astype(np.uint8)*128).copy()
        ImageDraw.floodfill(image,(int((-3100-self.x0)/self.step),int((-600-self.z0)/self.step)),255)
        connected = Image.fromarray((np.asarray(image)==255).astype(np.uint8)*255)
        # A narrow filter rounds off the DEM cell corners. The broader one
        # describes the sheltered water along banks and on either side of spits.
        self.mask = (.78*np.asarray(connected.filter(ImageFilter.GaussianBlur(1.4)))+
                     .22*np.asarray(connected.filter(ImageFilter.GaussianBlur(7))))/255

    def __call__(self, x, z):
        height,width = self.mask.shape
        u=np.clip((x-self.x0)/self.step,0,width-1.001)
        v=np.clip((z-self.z0)/self.step,0,height-1.001)
        i,j=u.astype(int),v.astype(int)
        return mix(mix(self.mask[j,i],self.mask[j,i+1],u-i),
                   mix(self.mask[j+1,i],self.mask[j+1,i+1],u-i),v-j)


def wind_texture(size):
    # Directional gravity waves have many wavelengths and directions. Store
    # the two derivatives of one continuous height field so crests break up
    # naturally instead of forming parallel lines across the entire lake.
    rng=np.random.default_rng(730)
    kx=np.fft.fftfreq(size)[None,:]*size
    kz=np.fft.fftfreq(size)[:,None]*size
    k=np.maximum(.001,np.hypot(kx,kz))
    band=np.exp(-.5*(np.log(k/12)/.72)**2)*(.22+.78*(kx/k)**4)/k**1.35
    height=np.fft.fft2(rng.standard_normal((size,size)))*band
    sx=np.fft.ifft2(1j*kx*height).real
    sz=np.fft.ifft2(1j*kz*height).real
    # y in the shader increases opposite to image rows.
    slope_scale=.167/sx.std()
    lanes=np.fft.ifft2(np.fft.fft2(rng.standard_normal((size,size)))*
                       np.exp(-.5*((kx/2.2)**2+(kz/6.8)**2))).real
    data=.5+np.stack((sx*slope_scale,-sz*slope_scale,(lanes-lanes.mean())*(.19/lanes.std())),axis=2)
    data=np.clip(data,0,1)
    srgb=np.where(data<.0031308,data*12.92,1.055*data**(1/2.4)-.055)
    return np.rint(srgb*255).astype(np.uint8)


def lake_atlas(dem, atlas_width, height, source):
    shore = LakeShore(dem)
    width=3*atlas_width//4
    levels = MIRROR_TOP*(1-(np.arange(height)+.5)/height)
    tangent = np.tan(levels*DEG)
    drop = EYE-LAKE_LEVEL
    curvature = 14800000.
    # Distance along each viewing ray to the lake, with the same curvature
    # correction as the terrain survey. The top edge of the water is farthest.
    water_dist = 2*drop/(tangent+np.sqrt(np.maximum(0,tangent*tangent-4*drop/curvature)))
    ranges = np.r_[np.arange(8,7200,9.),np.arange(7200,24000,26.),np.arange(24000,50001,63.)]
    before = np.clip(np.searchsorted(ranges,water_dist)-1,0,len(ranges)-1)
    fields = [np.empty((height,width,4),np.uint8) for _ in range(2)]
    for start in range(0,width,64):
        end=min(start+64,width)
        az=LAKE_WEST+LAKE_SPAN*(np.arange(start,end)+.5)/width
        vx,vz=np.sin(az*DEG),-np.cos(az*DEG)
        r=ranges[:,None]
        x,z=r*vx,r*vz
        h=dem(x,z)
        wet=shore(x,z)>.5
        direct=np.arctan2(h-EYE-r*r/curvature,r)/DEG
        blocker=np.maximum.accumulate(np.where(h>LAKE_LEVEL+1.,direct,-90.),axis=0)[before]
        visible=shore(water_dist[:,None]*vx,water_dist[:,None]*vz)*smooth(-.026,.026,-levels[:,None]-blocker)
        # A mirror ray starts at the water and sees only scenery beyond it.
        # Reflect the eye across the lake plane and clip at the opposing bank
        # for that particular bay, including the two sides of a peninsula.
        reflected=np.arctan2(h-(LAKE_LEVEL-drop)-r*r/curvature,r)/DEG
        distance=np.empty_like(visible)
        cover=np.empty_like(visible)
        for col,line in enumerate(wet.T):
            transitions=np.diff(np.r_[False,line,False].astype(int))
            entries=np.flatnonzero(transitions==1)
            exits=np.flatnonzero(transitions==-1)
            if not entries.size:
                entries,exits=[0],[np.searchsorted(ranges,2600.)]
            boundaries=(ranges[exits[:-1]]+ranges[entries[1:]])*.5
            bays=np.searchsorted(boundaries,water_dist)
            for bay,bank in enumerate(exits):
                take=bays==bay
                if not take.any():
                    continue
                profile=reflected[bank:,col]
                horizon=np.maximum.accumulate(profile)
                crest=horizon[-1]; elev=levels[take]
                hi=np.searchsorted(horizon,np.minimum(crest,elev))
                lo=np.maximum(0,hi-1)
                t=np.clip((elev-profile[lo])/np.maximum(.0001,profile[hi]-profile[lo]),0,1)
                distance[take,col]=mix(ranges[bank+lo],ranges[bank+hi],t)
                cover[take,col]=smooth(-.035,.035,crest-elev)
        alpha=np.rint(64+188*visible).astype(np.uint8)
        for k,(field,land) in enumerate(zip(fields,land_colors(dem,distance*vx,distance*vz,distance))):
            air=background(az/360,levels,bool(k),source)
            pane=field[:,start:end]
            pane[:,:,:3]=np.rint(255*np.clip(mix(air,land,cover[...,None]),0,1))
            # Retain reflected colours outside the shore so distorted samples
            # near the bank never pick up transparent black.
            pane[:,:,3]=alpha
    # The right quarter repeats one slope tile with half a tile of padding
    # all around the lookup region for bilinear and mip filtering.
    normals=Image.fromarray(wind_texture(height)).resize((atlas_width//8,height),Image.Resampling.BILINEAR)
    slopes=Image.fromarray(np.tile(np.asarray(normals),(2,2,1))).convert("RGBA")
    atlas=Image.new("RGBA",(atlas_width,2*height))
    atlas.paste(Image.fromarray(np.concatenate(fields,axis=0)),(0,0))
    atlas.paste(slopes,(width,0))
    return atlas


def bake(dem, width, height, folder):
    if width % 2 or height % 16:
        raise ValueError("Use an even width and a height divisible by sixteen.")
    sky_height, near_height = height//4, height*5//16
    source = np.asarray(Image.open(ART/"haruna-sky.webp").convert("RGB"),dtype=np.float32)/255
    # The break lies past Lake Yamanaka and in front of Fuji. Start the near
    # rays below the survey eye so low views sample the actual hillside.
    near_ranges = np.r_[np.arange(8,162,3),np.arange(162,810,8),np.arange(810,6500,16),6500.]
    far_ranges = np.r_[np.arange(6500,9200,16),np.arange(9200,24001,22),np.arange(24050,50001,63)]
    far = render_band(dem,width,height-sky_height-near_height,far_ranges,False)
    near = render_band(dem,width,near_height,near_ranges,True)
    for k,stem in enumerate(("mikuni-afternoon-horizon","mikuni-blue-hour-horizon")):
        img = np.concatenate((sky_band(width,sky_height,bool(k),source),far[k],near[k]),axis=0)
        dest=folder/(stem+".webp")
        Image.fromarray(img).save(dest,quality=96,method=6,exact=True)
        print(stem, dest.stat().st_size,flush=True)
    lake = folder/"mikuni-lake.webp"
    lake_atlas(dem,width//2,sky_height,source).save(lake,quality=95,method=6,exact=True)
    print(lake.name,lake.stat().st_size,flush=True)


if __name__=="__main__":
    parser=ArgumentParser(description=__doc__)
    parser.add_argument("tiles",type=Path)
    parser.add_argument("--out",type=Path,default=ART)
    parser.add_argument("--width",type=int,default=4096)
    parser.add_argument("--height",type=int,default=1024)
    args=parser.parse_args()
    bake(Terrain(args.tiles),args.width,args.height,args.out)
