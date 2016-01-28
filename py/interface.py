import pico
from svggen.library import filterComponents
import json

def components(filters=["actuator","mechanical"]):
    l = []
    for c in filterComponents(filters):
        l.append(c)
    return l
