from svggen.api import FoldedComponent
import os
from oct2py import Oct2Py

def eqnsToCostFunc(eqns):
    cost = ""
    for x in eqns:
        x = x.lhs - x.rhs
        stri = repr(x)
        stri = stri.replace("**","^")
        cost += "(" + stri + ")^2 + "
    return cost[:-3]

def octavifyVector(eqns):
    for i in range(len(eqns)):
        eqns[i] = eqns[i].lhs - eqns[i].rhs
        stri = repr(eqns[i])
        eqns[i] = stri.replace("**","^").replace(" ","")
    return eqns

def createOctaveScriptObj(relations,defs,g):
    cfunc = eqnsToCostFunc(relations)
    nonlin = octavifyVector(g)
    mapping = []
    defarray = []
    i = 1
    for v in defs:
        defarray.append(defs[v])
        mapping.append((v,"x("+str(i)+")"))
        i+=1
    mapping.sort()
    mapping = mapping[::-1]
    for x in mapping:
        cfunc = cfunc.replace(x[0],x[1])
        for i in range(len(nonlin)):
            nonlin[i] = nonlin[i].replace(x[0],x[1])
    script = open("/tmp/solve.m",'w')
    script.write("function x = solve()\n")    
    script.write("\tx0 = [ ")
    for x in defarray:
        script.write(str(float(x))+"; ")
    script.write("];\n")
    script.write("\t[x, obj, info, iter, nf, lambda] = sqp (x0, @phi, @g, []);\n")
    script.write("\tfunction r = g(x)\n\t\tr = [ ")
    for x in nonlin:
        script.write(x+"; ")
    script.write("];\nendfunction\n\tfunction obj = phi(x)\n\t\tobj = " + cfunc + ";\nendfunction\n")
    script.write("endfunction\n")
    script.close()
    oc = Oct2Py()
    oc.addpath("/tmp")
    solarr = oc.solve()
    os.remove('/tmp/solve.h')
    solutions = {}
    i = 0
    for v in defs:
        solutions[v] = float(solarr[i])
        i+=1
    return solutions
