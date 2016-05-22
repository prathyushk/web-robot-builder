import oct2py
from svggen.api import FoldedComponent
import os
import sympy

def eqnsToCostFunc(eqns):
    cost = ""
    for x in eqns:
        x = x.lhs - x.rhs
        stri = repr(x)
        stri = stri.replace("**","^")
        cost += "(" + stri + ")^2 + "
    return cost[:-3]

def octavifyConstraints(eqns):
    eq = []
    ineq = []
    for i in range(len(eqns)):
        if isinstance(eqns[i],sympy.Eq):
            stri = repr(eqns[i].lhs - eqns[i].rhs)
            eq.append(stri.replace("**","^").replace(" ",""))
        elif isinstance(eqns[i],sympy.StrictGreaterThan) or isinstance(eqns[i],sympy.GreaterThan):
            stri = repr(eqns[i].lhs - eqns[i].rhs)
            ineq.append(stri.replace("**","^").replace(" ",""))
        elif isinstance(eqns[i],sympy.StrictLessThan) or isinstance(eqns[i],sympy.LessThan):
            stri = repr(eqns[i].rhs - eqns[i].lhs)
            ineq.append(stri.replace("**","^").replace(" ",""))
    return (eq,ineq)

def createOctaveScriptObj(relations,defs,g):
    cfunc = eqnsToCostFunc(relations)
    eqConstr,ineqConstr = octavifyConstraints(g)
    lb = {}
    ub = {}
    for i in defs:
        if "dx" not in i and "dy" not in i and "dz" not in i and "q_a" not in i and "q_i" not in i and "q_k" not in i and "q_j" not in i:
            lb[i] = defs[i] * 0.5;
            ub[i] = "realmax";
        else:
            lb[i] = "-realmax";
            ub[i] = "realmax";
    mapping = []
    defarray = []
    lbarr = []
    ubarr = []
    i = 1
    for v in defs:
        defarray.append(defs[v])
        lbarr.append(lb[v])
        ubarr.append(ub[v])
        mapping.append((v,"x("+str(i)+")"))
        i+=1
    mapping.sort(lambda x,y: cmp(len(x[0]),len(y[0])))
    mapping = mapping[::-1]
    for x in mapping:
        cfunc = cfunc.replace(x[0],x[1])
        for i in range(len(eqConstr)):
            eqConstr[i] = eqConstr[i].replace(x[0],x[1])
        for i in range(len(ineqConstr)):
            ineqConstr[i] = ineqConstr[i].replace(x[0],x[1])
    script = open("/tmp/solve.m",'w')
    script.write("function x = solve()\n")    
    script.write("\tx0 = [ ")
    for x in defarray:
        script.write(str(float(x))+"; ")
    script.write("];\n")
    script.write("\tlb = [ ")
    for x in lbarr:
        script.write(str(x)+"; ")
    script.write("];\n")
    script.write("\tub = [ ")
    for x in ubarr:
        script.write(str(x)+"; ")
    script.write("];\n")
    script.write("\t[x, obj, info, iter, nf, lambda] = sqp (x0, @phi, ")
    if(len(eqConstr) > 0):
        script.write("@g, ")
    else:
        script.write("[], ")
    if(len(ineqConstr) > 0):
        script.write("@h, lb, ub, realmax);\n")
    else:
        script.write("[], lb, ub, realmax);\n")
    if(len(eqConstr) > 0):
        script.write("\tfunction r = g(x)\n\t\tr = [ ")
        for x in eqConstr:
            script.write(x+"; ")
        script.write("];\n\tendfunction\n")
    if(len(ineqConstr) > 0):
        script.write("\tfunction rr = h(x)\n\t\trr = [ ")
        for x in ineqConstr:
            script.write(x+"; ")
        script.write("];\n\tendfunction\n")
    script.write("\tfunction obj = phi(x)\n\t\tobj = " + cfunc + ";\n\tendfunction\n")
    script.write("endfunction\n")
    script.close()
    oc = oct2py.Oct2Py()
    oc.addpath("/tmp")
    solarr = oc.solve()
    os.remove('/tmp/solve.m')
    solutions = {}
    i = 0
    for v in defs:
        solutions[v] = float(solarr[i])
        i+=1
    return solutions
