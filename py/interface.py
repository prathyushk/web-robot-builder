import pico
from svggen.library import filterComponents, getComponent
from svggen.api.component import Component
import json
import ast

def components(filters=["actuator","mechanical"]):
    l = []
    l.append(filters)
    for c in filterComponents(filters):
        l.append(c)
    return l

def generate_stl(name):
    c = getComponent(name)
    c.makeOutput("/var/www/html/web-robot-builder/models/" + name, testparams=True,display=False,tree=False)
    return True

def getParameters(className):
    c = getComponent(className)
    return c.parameters

def portLookup(v,c):
    return globals()[v](c,None)

def generateFromObj(obj):
    c = Component()
    for k,v in obj["parameters"].iteritems():
        c.addParameter(k,ast.literal_eval(v.encode('ascii','ignore')))
    for i in obj["subcomponents"]:
        c.addSubcomponent(i["name"],i["className"])
        for k,v in i["parameters"].iteritems():
            if v == '' or v is None:
                continue
            try:
                if isinstance(v, basestring):
                    v = ast.literal_eval(v.encode('ascii','ignore'))
                if isinstance(v, float) or isinstance(v, int):
                    c.addConstConstraint((i["name"],k),v)
            except:
                v = v.split(',')
                if(i["parameterfuncs"][k] != ''):
                    if(len(v) > 1):
                        c.addConstraint((i["name"],k),v,i["parameterfuncs"][k])
                    else:
                        c.addConstraint((i["name"],k),v[0],i["parameterfuncs"][k])
                else:
                    if(len(v) > 1):
                        c.addConstraint((i["name"],k),v)
                    else:
                        c.addConstraint((i["name"],k),v[0])
        for k,v in i["interfaces"].iteritems():
            if(v is None):
                continue
            if(v == True):
                c.inheritInterface(k, (i["name"],k))
    for i in obj["connections"]:
        int1 = i["interface1"].split('.')
        int2 = i["interface2"].split('.')
        args = i["args"].split(',')
        argsDict = {}
        for arg in args:
            equalsSplit = arg.split('=')
            if len(equalsSplit) > 1:
                argsDict[equalsSplit[0]] = ast.literal_eval(equalsSplit[1])
        c.addConnection((int1[0],int1[1]),(int2[0],int2[1]),**argsDict)
    c.makeOutput("/var/www/html/web-robot-builder/models/" + obj["name"],display=False,tree=False)
    c.toYaml("/var/www/html/web-robot-builder/models/" + obj["name"] + "/"+obj["name"]+".yaml")
    return obj["name"]
