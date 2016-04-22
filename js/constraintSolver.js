function Equation(){
    this.op1 = undefined;
    this.op2 = undefined;
    this.operator = undefined;
    this.value = undefined;
    this.derivatives = {};
    this.functionBuild = function(funcName, op1){
	this.op1 = op1;
	switch(funcName){
	case 'sqrt':
	    this.value = Math.sqrt(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = 0.5 * Math.pow(op1.value,-0.5) * op1.derivatives[v];
	    }
	    break;
	case 'cos':
	    this.value = Math.cos(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = -Math.sin(op1.value) * op1.derivatives[v];
	    }
	    break;
	case 'sin':
	    this.value = Math.sin(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = Math.cos(op1.value) * op1.derivatives[v];
	    }
	    break;
	case 'tan':
	    this.value = Math.tan(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = 1/Math.pow(Math.cos(op1.value),2) * op1.derivatives[v];
	    }
	    break;
	case 'acos':
	    this.value = Math.acos(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = -1./Math.sqrt((1.-Math.pow(op1.value,2))) * op1.derivatives[v];
	    }
	    break;
	case 'asin':
	    this.value = Math.asin(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = 1./Math.sqrt((1.-Math.pow(op1.value,2))) * op1.derivatives[v];
	    }
	    break;
	case 'atan':
	    this.value = Math.atan(op1.value);
	    for(var v in op1.derivatives){
		this.derivatives[v] = 1./(1.+Math.pow(op1.value,2)) * op1.derivatives[v];
	    }
	    break;
	}
    }
    this.build = function(op1,op2,operator){
	this.op1 = op1;
	this.op2 = op2;
	this.operator = operator;
	switch(operator)
	{
	    case '+':
	    this.derivatives = op1.derivatives;
	    for(var v in op2.derivatives){
		if(this.derivatives[v] != undefined)
		    this.derivatives[v] += op2.derivatives[v];
		else
		    this.derivatives[v] = op2.derivatives[v];
	    }
	    this.value = op1.value + op2.value;
	    break;
	    case '==':
	    case '-':
	    this.derivatives = op1.derivatives;
	    for(var v in op2.derivatives){
		if(this.derivatives[v] != undefined)
		    this.derivatives[v] -= op2.derivatives[v];
		else
		    this.derivatives[v] = -op2.derivatives[v];
	    }
	    this.value = op1.value - op2.value;
	    break;
	    case '*':
	    for(var v in op1.derivatives){
		var val = op2.value * op1.derivatives[v];
		if(op2.derivatives[v] != undefined)
		    val += op1.value * op2.derivatives[v];
		this.derivatives[v] = val;
	    }
	    for(var v in op2.derivatives){
		if(this.derivatives[v] == undefined)
		    this.derivatives[v] = op1.value * op2.derivatives[v];
	    }
	    this.value = op1.value * op2.value;
	    break;
	    case '/':
	    for(var v in op2.derivatives){
		var val = -op1.value * op2.derivatives[v];
		if(op1.derivatives[v] != undefined)
		    val = op2.value*op1.derivatives[v] + val;
		this.derivatives[v] = val/Math.pow(op2.derivatives[v],2);
	    }
	    this.value = op1.value / op2.value;
	    break;
	    case '^':
	    for(var v in op1.derivatives){
		this.derivatives[v] = op2.value * Math.pow(op1.value,op2.value - 1) * op1.derivatives[v];
	    }
	    this.value = Math.pow(op1.value,op2.value);
	    break;
	}
    }
}

function evalExpression(eq, map){
    return evalExpressionTree(math.parse(eq),map);
}

function evalExpressionTree(tree,map){
    if(tree == undefined)
	return undefined;
    var curr = new Equation();
    if(tree.type == "ParenthesisNode")
	return evalExpressionTree(tree.content,map);
    else if(tree.type == "OperatorNode"){
	var left, right;
	if(tree.args.length == 1){
	    left = new Equation();
	    left.value = 0;
	    right = evalExpressionTree(tree.args[0],map);
	}
	else{
	    left = evalExpressionTree(tree.args[0],map);
	    right = evalExpressionTree(tree.args[1],map);
	}
	curr.build(left,right,tree.op);
    }
    else if(tree.type == "SymbolNode"){
	if(tree.name == "pi")
	    curr.value = Math.PI;
	else{
	    curr.name = tree.name;
	    curr.value = map[tree.name];
	    curr.derivatives[tree.name] = 1;
	}
    }
    else if(tree.type == "ConstantNode")
	curr.value = Number(tree.value);
    else if(tree.type == "FunctionNode"){
	var operand = evalExpressionTree(tree.args[0],map);
	curr.functionBuild(tree.name,operand);
    }
    return curr;
}

function derivativesLessThan(equation){
    for(var i in equation.derivatives){
	if(Math.abs(equation.derivatives[i]) >= 1e-12)
	    return false;
    }
    return true;
}

function step(eq, map){
    var currval = evalExpression(eq,map);
    if(currval.value < 1e-12 || derivativesLessThan(currval))
	return null;
    var sum = 0;
    for(var v in currval.derivatives){
	sum += Math.pow(currval.derivatives[v],2);
    }
    var threshold = 0.5 * sum;
    function backtrack(stepSize){
	var newmap = {};
	for(var key in map){
	    if(currval.derivatives[key] == undefined)
		newmap[key] = map[key];
	    else 
		newmap[key] = map[key] - stepSize*currval.derivatives[key];
	}
	var nval = evalExpression(eq, newmap);
	if(currval.value - nval.value >= stepSize*threshold)
	    return [newmap,Math.abs(currval.value-nval.value) < 1e-12];
	else
	    return backtrack(stepSize*0.5);
    }
    var out = backtrack(1);
    if(out[1])
	return null;
    return out[0];
}

function minimize(eq, map){
    var n = map;
    while(1){
	map = step(eq,map);
	if(map == null)
	    break;
	n = map;
    }
    return n;
}

function allSatisfied(arr){
    for(var v = 0, len = arr.length; v < len; v++)
	if(arr[v] == false)
	    return false;
    return true;
}

function solveSystem(eqns, map){
    var eqn = "("+eqns[0]+")^2";
    for(var i = 1, len = eqns.length; i < len; i++)
	eqn += "+("+eqns[i]+")^2";
    var newmap = minimize(eqn,map);
    var satisfied = [];
    for(var i = 0, len = eqns.length; i < len; i++){
	satisfied.push(Math.pow(evalExpression(eqns[i],newmap).value,2) < Math.sqrt(1e-12));
    }
    if(allSatisfied(satisfied))
	return [satisfied,newmap];
    else{
	var v;
	for(v = 0,len = eqns.length; v < len; v++){
	    if(!satisfied[v]){
		eqns.splice(v,1);
		break;
	    }
	}
	var output = solveSystem(eqns,newmap);
	output[0].splice(v,0,false);
	return output;
    }
}
