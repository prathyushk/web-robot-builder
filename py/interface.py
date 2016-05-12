import pico
from svggen.library import filterComponents, getComponent
from svggen.api.component import Component
from svggen.api import FoldedComponent
from svggen.api.ports.EdgePort import *
from svggen.utils import mymath as np
from svggen.utils.transforms import InverseQuat, MultiplyQuat, NormalizeQuat
from sympy_interop import *
import casadi
import sympy
import json
import ast

def components(filters=["actuator","mechanical"]):
    l = []
    l.append(filters)
    for c in filterComponents(filters):
        l.append(c)
    return l

def solveObject(c):
    sse = 0
    relations = c.getRelations()
    quatConstr = relations[:len(c.subcomponents)+1]
    relations = relations[len(c.subcomponents)+1:]
    if len(relations) > 0:
        for e in relations:
            sse += (e.lhs - e.rhs)**2
        cvars = [x for x in c.getVariables()]
        defs = c.getAllDefaults()
        varord = {}
        defarray = []
        i = 0
        for v in cvars:
            varord[v.name] = casadi.SX.sym(v.name)
            i += 1
            defarray.append(defs[v.name])
        SXsse = sympy2casadi(sse,varord)
        SXsse += (varord["r1_w"]-400)**2
        SXsse += (varord["r1_l"]-100)**2
        SXsse += (varord["r2_w"]-400)**2
        SXsse += (varord["r2_l"]-100)**2
        consts = [sympy2casadi(q.lhs-q.rhs,varord) for q in quatConstr]
        #consts = consts + [varord["r1_w"],varord["r1_l"],varord["r2_w"],varord["r2_l"]]
        print len(consts)
        nlp = {'x':casadi.vertcat(*varord.values()),'f':SXsse,'g':casadi.vertcat(*consts)}
        solver = casadi.nlpsol('nlp','ipopt',nlp,{'ipopt':{'max_iter':2147483647}})
        low = [0]*(len(consts))# + [100,400,100,400]
        up = [0]*(len(consts))# + [100,400,100,400]
        sol = solver(x0=defarray,lbg=low,ubg=up)
        print SXsse
        out = sol['x']
        solved = {}
        kys = varord.keys()
        for i in range(len(kys)):
            solved[kys[i]] = float(out[i])
        if len(c.subcomponents.values()) > 0:
            ref = c.subcomponents.keys()[0] + "_"
            dx = solved[ref + "dx"]
            dy = solved[ref + "dy"]
            dz = solved[ref + "dz"]
            quat = (solved[ref + "q_a"],solved[ref + "q_i"],solved[ref + "q_j"],solved[ref + "q_k"])
            invQuat = InverseQuat(quat)
            transformed = []
            for k,v in solved.iteritems():
                if "dx" in k:
                    solved[k] -= dx
                elif "dy" in k:
                    solved[k] -= dy
                elif "dz" in k:
                    solved[k] -= dz
            for k,v in solved.iteritems():
                if "q_" in k:
                    pref = k[:k.index("q_")]
                    if pref in transformed:
                        continue
                    q = (solved[pref+"q_a"],solved[pref+"q_i"],solved[pref+"q_j"],solved[pref+"q_k"])
                    p = (0,solved[pref+"dx"],solved[pref+"dy"],solved[pref+"dz"])
                    newQ = MultiplyQuat(invQuat,q)
                    newP = MultiplyQuat(p,quat)
                    newP = MultiplyQuat(invQuat,newP)
                    solved[pref+"q_a"],solved[pref+"q_i"],solved[pref+"q_j"],solved[pref+"q_k"] = newQ
                    z,solved[pref+"dx"],solved[pref+"dy"],solved[pref+"dz"] = newP
                    transformed.append(pref)

            solved["dx"],solved["dy"],solved["dz"] = 0,0,0
            solved["q_a"],solved["q_i"],solved["q_j"],solved["q_k"] = 1,0,0,0
            return solved
    else:
        return c.getAllDefaults()


def extractFromComponent(c):
    output = {}
    output["variables"] = [x for x in c.getVariables()]
    output["relations"] = c.getRelations()
    output["defaults"] = c.getAllDefaults()
    output["faces"] = {}
    for i in c.composables['graph'].faces:
        tdict = i.getTriangleDict()
        for vertex in range(len(tdict["vertices"])):
            try:
                tpl = tdict["vertices"][vertex]
                tdict["vertices"][vertex] = [tpl[0],tpl[1]]
                tdict["vertices"][vertex][0] = tdict["vertices"][vertex][0].subs(c.getVariableSubs())
                tdict["vertices"][vertex][1] = tdict["vertices"][vertex][1].subs(c.getVariableSubs())
            except:
                try:
                    tdict["vertices"][vertex][1] = tdict["vertices"][vertex][1].subs(c.getVariableSubs())
                except:
                    pass
        output["faces"][i.name] = [[i.transform3D[x].subs(c.getVariableSubs()) for x in range(len(i.transform3D))], tdict]
    output["edges"] = {}
    output["edges2D"] = {}
    for i in c.composables['graph'].edges:
        output["edges"][i.name] = []
        output["edges2D"][i.name] = []
        for v in range(2):
            output["edges"][i.name].append([])
            output["edges2D"][i.name].append([])
            for x in range(3):
                output["edges"][i.name][v].append(i.pts3D[v][x].subs(c.getVariableSubs()))
                if x != 2:
                    output["edges2D"][i.name][v].append(i.pts2D[v][x].subs(c.getVariableSubs()))
    output["interfaceEdges"] = {}
    for k,v in c.interfaces.iteritems():
        obj = c.getInterface(k)
        if isinstance(obj,EdgePort):
            output["interfaceEdges"][k] = []
            for i in obj.getEdges():
                try:
                    output["interfaceEdges"][k].append(i)
                except:
                    pass
    output["solved"] = solveObject(c)
    print output["solved"]
    return output

def getSymbolic(args):
    name = args[0]
    tempParams = args[1]
    c = getComponent(name,**tempParams)
    return extractFromComponent(c)

def generate_stl(args):
    name = args[0]
    tempParams = args[1]
    c = getComponent(name,**tempParams)
    try:
        c.makeOutput("/var/www/html/web-robot-builder/models/" + name, testparams=True,display=False,tree=False)
    except:
        try:
            c.makeOutput("/var/www/html/web-robot-builder/models/" + name, testparams=False,display=False,tree=False)
        except:
            for k,v in c.parameters.iteritems():
                if v is None:
                    raise KeyError("Parameter %s not initialized on object" % k)
    edgeNames = {}
    for k,v in c.interfaces.iteritems():
        obj = c.getInterface(k)
        if isinstance(obj,EdgePort):
            edgeNames[k] = {}
            for i in obj.getEdges():
                try:
                    edgeNames[k][i] = c.composables['graph'].getEdge(i).pts3D
                except:
                    pass
    return edgeNames

def getParameters(className):
    c = getComponent(className)
    return c.parameters

def portLookup(v,c):
    return globals()[v](c,None)

def generateFromObj(obj):
    #c = Component()
    c = FoldedComponent.FoldedComponent()
    #for k,v in obj["parameters"].iteritems():
    #    c.addParameter(k,eval(v))
    for i in obj["subcomponents"]:
        c.addSubcomponent(i["name"],i["className"])
        '''for k,v in i["parameters"].iteritems():
            if v == '' or v is None:
                continue
            try:
                c.addConstConstraint((i["name"],k),eval(v))
            except:
                try:
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
                except:
                    c.addConstConstraint((i["name"],k),v)'''
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
    c.make()
    #c.makeOutput("/var/www/html/web-robot-builder/models/" + obj["name"],display=False,tree=False)
    #c.toYaml("/var/www/html/web-robot-builder/models/" + obj["name"] + "/"+obj["name"]+".yaml")
    #return obj["name"]
    return extractFromComponent(c)
