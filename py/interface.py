import pico
from svggen.library import filterComponents, getComponent
import json

def components(filters=["actuator","mechanical"]):
    l = []
    l.append(filters)
    for c in filterComponents(filters):
        l.append(c)
    return l

def generate_stl(name):
    c = getComponent(name)
    c.makeOutput("/var/www/html/web-robot-builder/models/" + name, testparams=True,display=False,tree=False)
    return True;

def getParameters(className):
    c = getComponent(className)
    return c.parameters
