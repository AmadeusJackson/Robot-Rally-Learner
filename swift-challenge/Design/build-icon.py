#!/usr/bin/env python3
"""Build the original rover's vector layers; Apple supplies masking and materials."""
from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
assets = root / 'RobotRally/AppIcon.icon/Assets'
assets.mkdir(parents=True, exist_ok=True)
header = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">\n'
transform = '<g transform="rotate(28 512 512)">\n'
footer = '</g>\n</svg>\n'
# One shared transform prevents the component alignment errors in the concept drafts.
tires, rollers = [], []
stripe = 'M16 48 L98 20 Q112 16 112 30 L112 48 L30 92 Q16 100 16 86 Z M16 120 L98 76 Q112 68 112 82 L112 100 L30 148 Q16 156 16 142 Z'
for x,y,mirror in [(220,278,False),(676,278,True),(220,570,True),(676,570,False)]:
    tires.append(f'<rect x="{x}" y="{y}" width="128" height="176" rx="38"/>')
    flip = 'translate(128 0) scale(-1 1)' if mirror else ''
    rollers.append(f'<g transform="translate({x} {y})"><path transform="{flip}" d="{stripe}"/></g>')
# Shape, default color, dark color. All appearances use exactly the same geometry.
layers = {
 '01-tires': ('\n'.join(tires), '253644', '688395'),
 '02-rollers': ('\n'.join(rollers), 'F4EEE1', 'CED9DD'),
 '03-chassis': ('<rect x="324" y="282" width="376" height="460" rx="54"/>', 'F4EEE1', 'C1CFD4'),
 '04-bumpers': ('<rect x="302" y="244" width="420" height="88" rx="34"/><rect x="302" y="692" width="420" height="88" rx="34"/>', 'F47C35', 'D77B43'),
 '05-controller': ('<rect x="440" y="440" width="144" height="144" rx="24"/><rect x="420" y="470" width="32" height="24" rx="6"/><rect x="420" y="530" width="32" height="24" rx="6"/><rect x="572" y="470" width="32" height="24" rx="6"/><rect x="572" y="530" width="32" height="24" rx="6"/>', '347EAB', '5298BE'),
 '06-core': ('<rect x="482" y="482" width="60" height="60" rx="8"/>', 'F4EEE1', '243E51'),
 '07-sensor': ('<rect x="458" y="354" width="108" height="32" rx="12"/>', '253644', '243E51'),
}
def color(value):
    return 'srgb:'+','.join(f'{int(value[i:i+2],16)/255:.5f}' for i in (0,2,4))+',1.00000'
master = []
for name,(shape,light,dark) in layers.items():
    art = f'<g fill="#{light}">{shape}</g>'
    (assets / (name+'.svg')).write_text(header+transform+art+'\n'+footer)
    master.append(art)
for obsolete in ['01-running-gear.svg','02-chassis.svg','03-control-module.svg']:
    (assets/obsolete).unlink(missing_ok=True)
(root / 'Design/rover-master.svg').write_text(header+transform+'\n'.join(master)+'\n'+footer)

def layer(name):
    _,light,dark=layers[name]
    return {'image-name':name+'.svg','name':name,'fill-specializations':[
        {'value':'automatic'}, {'appearance':'dark','value':{'solid':color(dark)}}],
        'glass':True,'opacity':1}
# Icon Composer stores frontmost groups/layers first.
groups=[]
for name,names,specular in [('Electronics',['07-sensor','06-core','05-controller'],True),
                           ('Chassis and bumpers',['04-bumpers','03-chassis'],True),
                           ('Mecanum running gear',['02-rollers','01-tires'],False)]:
    groups.append({'name':name,'layers':[layer(n) for n in names], 'lighting':'individual',
                   'specular':specular, 'shadow':{'kind':'neutral','opacity':0.22},
                   'translucency':{'enabled':False,'value':0}})
manifest={'fill-specializations':[{'value':{'solid':color('91B0BF')}},
                                 {'appearance':'dark','value':{'solid':color('2B4355')}}],
          'groups':groups, 'supported-platforms':{'squares':['macOS']}}
(root/'RobotRally/AppIcon.icon/icon.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Wrote seven vector layers in three groups and an editable master.')
