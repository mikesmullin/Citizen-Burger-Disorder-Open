"""Repo-relative locations and ProperCase entity names."""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
TOOLS = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(PUBLIC, 'assets')
ENTITY_DIR = os.path.join(ASSETS, 'entities')
PREFAB_DIR = ENTITY_DIR  # alias used by convert / manifest
TRANSLATING = os.path.join(ROOT, 'tmp', 'translating')
TRANSLATING_SCENE = os.path.join(TRANSLATING, 'assets', 'scene')
EXPECTED_DIR = os.path.join(TRANSLATING, 'expected')

_STRIP = (
    'Resources/Prefabs/',
    'Resources/UI/IngredientSprites/',
    'Resources/UI/',
    'Resources/',
    'Scripts/Computer/Graphics/',
    'Scripts/',
    'Standard_Assets/Character_Controllers/',
    'Standard_Assets/',
    'public/assets/prefabs/',
    'public/assets/entities/',
    'assets/prefabs/',
    'assets/entities/',
)

# Unity basename (file or last path component) → (kind, ProperName)
ENTITY_BY_BASENAME = {
    'Player': ('heroes', 'Player'),
    'arm': ('heroes', 'Arm'),
    'NPC': ('mobs', 'Npc'),
    'rat': ('mobs', 'Rat'),
    'Truck': ('items', 'Truck'),
    'Bacon': ('items', 'Bacon'),
    'bun-bottom': ('items', 'BunBottom'),
    'bun-top': ('items', 'BunTop'),
    'Cheese': ('items', 'Cheese'),
    'Lettuce-Head-Full': ('items', 'LettuceHead'),
    'Lettuce-Head-Part': ('items', 'LettucePart'),
    'Lettuce': ('items', 'Lettuce'),
    'Patty': ('items', 'Patty'),
    'Tomato': ('items', 'Tomato'),
    '!Spatula': ('items', 'Spatula'),
    'Spatula': ('items', 'Spatula'),
    '!Knife': ('items', 'Knife'),
    'Knife': ('items', 'Knife'),
    'Plate': ('items', 'Plate'),
    'FireExtinguisher': ('items', 'FireExtinguisher'),
    'Fire': ('items', 'Fire'),
    'Cupboard': ('items', 'Cupboard'),
    '!Monitor': ('items', 'Monitor'),
    'Monitor': ('items', 'Monitor'),
    '!MonitorPickup': ('items', 'MonitorPickup'),
    'MonitorPickup': ('items', 'MonitorPickup'),
    '!pencil': ('items', 'Pencil'),
    'pencil': ('items', 'Pencil'),
    '!Whiteboard': ('items', 'Whiteboard'),
    'Whiteboard': ('items', 'Whiteboard'),
    'Notepad': ('items', 'Notepad'),
    'Paper': ('items', 'Paper'),
    '!PLight': ('items', 'PointLight'),
    'PLight': ('items', 'PointLight'),
    'PointLight': ('items', 'PointLight'),
    'Box': ('items', 'Box'),
    'BoxOpened': ('items', 'BoxOpen'),
    'BoxOpen': ('items', 'BoxOpen'),
    'LightSwitch': ('items', 'LightSwitch'),
    'NumberStand': ('items', 'NumberStand'),
    'Tip': ('items', 'Tip'),
    '!speechBubble': ('ui', 'SpeechBubble'),
    'speechBubble': ('ui', 'SpeechBubble'),
    'SpeechBubble': ('ui', 'SpeechBubble'),
    'NPC-Speech-Bubble': ('ui', 'NpcSpeechBubble'),
    'NpcSpeechBubble': ('ui', 'NpcSpeechBubble'),
    '!StaffMenu': ('ui', 'StaffMenu'),
    'StaffMenu': ('ui', 'StaffMenu'),
    '!CustomerMenu': ('ui', 'CustomerMenu'),
    'CustomerMenu': ('ui', 'CustomerMenu'),
    'sBunBottom': ('ui', 'BunBottom'),
    'sBunTop': ('ui', 'BunTop'),
    'sCheese': ('ui', 'Cheese'),
    'sLettuce': ('ui', 'Lettuce'),
    'sPatty': ('ui', 'Patty'),
}

# Unity texture path (as stored in converted JSON) → new path under assets/
TEX_RENAME = {
    'textures/cheese.png': 'textures/Cheese.png',
    'textures/Cheese.png': 'textures/ui/Cheese.png',
    'textures/bun-bottom.png': 'textures/BunBottom.png',
    'textures/bun-top.png': 'textures/BunTop.png',
    'textures/patty.png': 'textures/ui/Patty.png',
    'textures/lettuce.png': 'textures/ui/Lettuce.png',
    'textures/lettuce2.png': 'textures/Lettuce.png',
    'textures/lettuce-head-uv.png': 'textures/LettuceHead.png',
    'textures/bacon2.png': 'textures/Bacon.png',
    'textures/tomato3.png': 'textures/Tomato.png',
    'textures/breadTexture.png': 'textures/Bread.png',
    'textures/rat-Tex.png': 'textures/Rat.png',
    'textures/plate.png': 'textures/Plate.png',
    'textures/box.png': 'textures/Box.png',
    'textures/notepad.png': 'textures/Notepad.png',
    'textures/Paper.png': 'textures/Paper.png',
    'textures/fire-extinguisher-tex.png': 'textures/FireExtinguisher.png',
    'textures/bad-fire.png': 'textures/Fire.png',
    'textures/StaffMenuTex.png': 'textures/ui/StaffMenu.png',
    'textures/speechBubbleTex.png': 'textures/ui/SpeechBubble.png',
    'textures/burger.png': 'textures/ui/Burger.png',
    'textures/Bubble.png': 'textures/ui/Bubble.png',
    'textures/arrow.png': 'textures/ui/Arrow.png',
    'textures/family.png': 'textures/ui/Family.png',
    'textures/kitchenFloor.png': 'entities/tiles/KitchenFloor.png',
    'textures/2.png': 'textures/skins/Npc2.png',
    'textures/feac.png': 'textures/Feac.png',
    'textures/orange.png': 'textures/Orange.png',
    'textures/grey.png': 'textures/Grey.png',
    'textures/greyDark.png': 'textures/GreyDark.png',
    'textures/lightGrey.png': 'textures/LightGrey.png',
    'textures/brown.png': 'textures/Brown.png',
    'textures/green.png': 'textures/Green.png',
    'textures/wood.png': 'textures/Wood.png',
    'textures/tabletop.png': 'textures/Tabletop.png',
    'textures/darkred.png': 'textures/DarkRed.png',
    'textures/truck.png': 'textures/Truck.png',
    'textures/skins/1.png': 'textures/skins/Npc1.png',
    'textures/skins/2.png': 'textures/skins/Npc2.png',
    'textures/skins/3.png': 'textures/skins/Npc3.png',
    'textures/skins/4.png': 'textures/skins/Npc4.png',
    'textures/skins/5.png': 'textures/skins/Npc5.png',
    'textures/skins/6.png': 'textures/skins/Npc6.png',
    'textures/skins/1staff.png': 'textures/skins/Staff1.png',
    'textures/skins/2staff.png': 'textures/skins/Staff2.png',
    'textures/skins/3staff.png': 'textures/skins/Staff3.png',
    'textures/skins/4staff.png': 'textures/skins/Staff4.png',
    'textures/skins/5staff.png': 'textures/skins/Staff5.png',
    'textures/skins/6staff.png': 'textures/skins/Staff6.png',
    'textures/skins/7staff.png': 'textures/skins/Staff7.png',
    'textures/skins/cookServe.png': 'textures/skins/CookServe.png',
    'textures/skins/jorji.png': 'textures/skins/Jorji.png',
    'textures/skins/Kritz.png': 'textures/skins/Kritz.png',
}

# Source mesh filename stem → ProperCase
MESH_BY_SOURCE = {
    'rat': 'Rat',
    'lettuce-head': 'LettucePart',
    'box2': 'Box',
    'lettuce-head-full': 'LettuceHead',
    'tomato': 'Tomato',
    'notepad2-1': 'Notepad',
    'fire-extinguisher': 'FireExtinguisher',
    'lettuce': 'Lettuce',
    'bun-bottom': 'BunBottom',
    'StaffMenu': 'StaffMenu',
    'plate3': 'Plate',
    'bacon': 'Bacon',
    'speechBubble': 'SpeechBubble',
    'patty001': 'Patty',
    'bun-top2': 'BunTop',
    'truck': 'Truck',
}


def proj():
    return os.environ.get(
        'CBD_PROJ',
        os.path.join(ROOT, 'tmp', 'cbe2', 'Citizen-Burger-Disorder-Open'),
    )


def to_proper(name):
    name = name.lstrip('!')
    if len(name) >= 2 and name[0] == 's' and name[1].isupper():
        name = name[1:]
    parts = re.split(r'[-_]+', name)
    return ''.join((p[:1].upper() + p[1:]) for p in parts if p)


def entity_slug(basename):
    if basename in ENTITY_BY_BASENAME:
        kind, name = ENTITY_BY_BASENAME[basename]
        return f'{kind}/{name}'
    return 'items/' + to_proper(basename)


def shorten_slug(slug):
    """Any historical slug → heroes/Player, items/Cheese, …"""
    s = slug.replace('\\', '/').replace('~', '/')
    kinds = ('heroes/', 'mobs/', 'items/', 'tiles/', 'ui/')
    if s.startswith(kinds):
        kind, name = s.split('/', 1)
        raw = name.startswith('!') or '-' in name or (name[:1].islower() and name not in ('ui',)) \
            or (len(name) >= 2 and name[0] == 's' and name[1].isupper())
        if raw and name in ENTITY_BY_BASENAME:
            return entity_slug(name)
        return s
    if '/' not in s and s in ('House', 'GUITestScene'):
        return s
    for p in _STRIP:
        if s.startswith(p):
            s = s[len(p):]
            break
    # leftover group/Name from the prefabs/ era
    base = s.rsplit('/', 1)[-1]
    if base in ENTITY_BY_BASENAME:
        return entity_slug(base)
    if '/' in s:
        kind, name = s.split('/', 1)
        mapped = ENTITY_BY_BASENAME.get(name)
        if mapped:
            return f'{mapped[0]}/{mapped[1]}'
        return entity_slug(name)
    return entity_slug(s)


def slug_from_rel(rel):
    """Assets-relative Unity path → entity slug."""
    rel = rel.replace('\\', '/')
    return shorten_slug(os.path.splitext(rel)[0].replace(' ', '_'))


def normalize_slug(arg):
    s = arg.replace('\\', '/').replace('~', '/')
    for ext in ('.json', '.unity', '.prefab'):
        if s.lower().endswith(ext):
            s = s[:-len(ext)]
            break
    for prefix in (
        'public/assets/entities/',
        'public/assets/prefabs/',
        'public/assets/scene/',
        'tmp/translating/assets/scene/',
        'tmp/translating/expected/',
        'assets/entities/',
        'assets/prefabs/',
        'assets/scene/',
        'Assets/',
    ):
        if s.startswith(prefix) or s.startswith(prefix.lower()):
            s = s[len(prefix):]
            break
    return shorten_slug(s.replace(' ', '_'))


def prefab_json(slug):
    return os.path.join(ENTITY_DIR, *normalize_slug(slug).split('/')) + '.json'


def scene_json(slug):
    short = normalize_slug(slug)
    parts_short = short.split('/')
    parts_raw = slug.replace('\\', '/').replace('~', '/').split('/')
    candidates = [
        os.path.join(ENTITY_DIR, *parts_short) + '.json',
        os.path.join(TRANSLATING_SCENE, *parts_short) + '.json',
        os.path.join(TRANSLATING_SCENE, *parts_raw) + '.json',
    ]
    if len(parts_short) == 1:
        candidates.insert(0, os.path.join(TRANSLATING_SCENE, parts_short[0] + '.json'))
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0]


def expected_json(slug):
    short = normalize_slug(slug)
    p = os.path.join(EXPECTED_DIR, *short.split('/')) + '.json'
    if os.path.exists(p):
        return p
    raw = os.path.join(EXPECTED_DIR, *slug.replace('~', '/').split('/')) + '.json'
    if os.path.exists(raw):
        return raw
    return p


def iter_prefab_jsons():
    if not os.path.isdir(ENTITY_DIR):
        return
    for dirpath, _, files in os.walk(ENTITY_DIR):
        for f in sorted(files):
            if not f.endswith('.json'):
                continue
            p = os.path.join(dirpath, f)
            rel = os.path.splitext(os.path.relpath(p, ENTITY_DIR))[0]
            yield rel.replace(os.sep, '/'), p


iter_scene_jsons = iter_prefab_jsons


def mesh_proper_name(source_stem):
    return MESH_BY_SOURCE.get(source_stem, to_proper(source_stem))


def mesh_bin_rel(source_stem, index=0):
    name = mesh_proper_name(source_stem)
    if index == 0:
        return f'models/{name}.bin'
    return f'models/{name}_{index + 1}.bin'


def rewrite_tex(url):
    if not url:
        return url
    return TEX_RENAME.get(url, url)
