<!-- App.svelte -->
<script>
	import { Router, Route } from "svelte-routing";
	import Home from "./routes/Home.svelte";
	import Variables from "./routes/Variables.svelte";
	import NavLink from "./components/NavLink.svelte";
	import Developments from "./routes/Developments.svelte";
	import Reactivity from "./routes/Reactivity.svelte";
	import Bind from "./routes/Bind.svelte";
	import IfElse from "./routes/IfElse.svelte";
	import Components from "./routes/Components.svelte";
	import Cycle from "./routes/Cycle.svelte";

	export let url = "";
</script>

<div class="container">
	<main>
		<Router url="{url}">
			<nav>
				<NavLink to="/">Home</NavLink>
				<NavLink to="variables">Переменные</NavLink>
				<NavLink to="developments">События</NavLink>
				<NavLink to="reactivity">Реактивность</NavLink>
				<NavLink to="bind">bind</NavLink>
				<NavLink to="ifelse">Условные операторы</NavLink>
				<NavLink to="components">Компоненты</NavLink>
				<NavLink to="cycle">Циклы</NavLink>
			</nav>
			<div>
				<Route path="variables" component="{Variables}" />
				<Route path="/"><Home /></Route>
				<Route path="/developments"><Developments /></Route>
				<Route path="/reactivity"><Reactivity /></Route>
				<Route path="/bind"><Bind /></Route>
				<Route path="/ifelse"><IfElse /></Route>
				<Route path="/components"><Components /></Route>
				<Route path="/cycle"><Cycle /></Route>
			</div>
		</Router>
	</main>
</div>

<style>
	.container {
		width: 1200px;
		margin: 0 auto;
	}
</style>