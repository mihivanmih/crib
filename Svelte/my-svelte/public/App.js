'use strict';

function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function compute_rest_props(props, keys) {
    const rest = {};
    keys = new Set(keys);
    for (const k in props)
        if (!keys.has(k) && k[0] !== '$')
            rest[k] = props[k];
    return rest;
}
function null_to_empty(value) {
    return value == null ? '' : value;
}
function custom_event(type, detail, bubbles = false) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, false, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}
function onDestroy(fn) {
    get_current_component().$$.on_destroy.push(fn);
}
function createEventDispatcher() {
    const component = get_current_component();
    return (type, detail) => {
        const callbacks = component.$$.callbacks[type];
        if (callbacks) {
            // TODO are there situations where events could be dispatched
            // in a server (non-DOM) environment?
            const event = custom_event(type, detail);
            callbacks.slice().forEach(fn => {
                fn.call(component, event);
            });
        }
    };
}
function setContext(key, context) {
    get_current_component().$$.context.set(key, context);
}
function getContext(key) {
    return get_current_component().$$.context.get(key);
}
Promise.resolve();

// source: https://html.spec.whatwg.org/multipage/indices.html
const boolean_attributes = new Set([
    'allowfullscreen',
    'allowpaymentrequest',
    'async',
    'autofocus',
    'autoplay',
    'checked',
    'controls',
    'default',
    'defer',
    'disabled',
    'formnovalidate',
    'hidden',
    'ismap',
    'loop',
    'multiple',
    'muted',
    'nomodule',
    'novalidate',
    'open',
    'playsinline',
    'readonly',
    'required',
    'reversed',
    'selected'
]);

const invalid_attribute_name_character = /[\s'">/=\u{FDD0}-\u{FDEF}\u{FFFE}\u{FFFF}\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}]/u;
// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
// https://infra.spec.whatwg.org/#noncharacter
function spread(args, classes_to_add) {
    const attributes = Object.assign({}, ...args);
    if (classes_to_add) {
        if (attributes.class == null) {
            attributes.class = classes_to_add;
        }
        else {
            attributes.class += ' ' + classes_to_add;
        }
    }
    let str = '';
    Object.keys(attributes).forEach(name => {
        if (invalid_attribute_name_character.test(name))
            return;
        const value = attributes[name];
        if (value === true)
            str += ' ' + name;
        else if (boolean_attributes.has(name.toLowerCase())) {
            if (value)
                str += ' ' + name;
        }
        else if (value != null) {
            str += ` ${name}="${value}"`;
        }
    });
    return str;
}
const escaped = {
    '"': '&quot;',
    "'": '&#39;',
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
};
function escape(html) {
    return String(html).replace(/["'&<>]/g, match => escaped[match]);
}
function escape_attribute_value(value) {
    return typeof value === 'string' ? escape(value) : value;
}
function escape_object(obj) {
    const result = {};
    for (const key in obj) {
        result[key] = escape_attribute_value(obj[key]);
    }
    return result;
}
function each(items, fn) {
    let str = '';
    for (let i = 0; i < items.length; i += 1) {
        str += fn(items[i], i);
    }
    return str;
}
const missing_component = {
    $$render: () => ''
};
function validate_component(component, name) {
    if (!component || !component.$$render) {
        if (name === 'svelte:component')
            name += ' this={...}';
        throw new Error(`<${name}> is not a valid SSR component. You may need to review your build config to ensure that dependencies are compiled, rather than imported as pre-compiled modules`);
    }
    return component;
}
let on_destroy;
function create_ssr_component(fn) {
    function $$render(result, props, bindings, slots, context) {
        const parent_component = current_component;
        const $$ = {
            on_destroy,
            context: new Map(context || (parent_component ? parent_component.$$.context : [])),
            // these will be immediately discarded
            on_mount: [],
            before_update: [],
            after_update: [],
            callbacks: blank_object()
        };
        set_current_component({ $$ });
        const html = fn(result, props, bindings, slots);
        set_current_component(parent_component);
        return html;
    }
    return {
        render: (props = {}, { $$slots = {}, context = new Map() } = {}) => {
            on_destroy = [];
            const result = { title: '', head: '', css: new Set() };
            const html = $$render(result, props, {}, $$slots, context);
            run_all(on_destroy);
            return {
                html,
                css: {
                    code: Array.from(result.css).map(css => css.code).join('\n'),
                    map: null // TODO
                },
                head: result.title + result.head
            };
        },
        $$render
    };
}
function add_attribute(name, value, boolean) {
    if (value == null || (boolean && !value))
        return '';
    return ` ${name}${value === true ? '' : `=${typeof value === 'string' ? JSON.stringify(escape(value)) : `"${value}"`}`}`;
}

const subscriber_queue = [];
/**
 * Creates a `Readable` store that allows reading by subscription.
 * @param value initial value
 * @param {StartStopNotifier}start start and stop notifications for subscriptions
 */
function readable(value, start) {
    return {
        subscribe: writable(value, start).subscribe
    };
}
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
    let stop;
    const subscribers = new Set();
    function set(new_value) {
        if (safe_not_equal(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (const subscriber of subscribers) {
                    subscriber[1]();
                    subscriber_queue.push(subscriber, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop) {
        const subscriber = [run, invalidate];
        subscribers.add(subscriber);
        if (subscribers.size === 1) {
            stop = start(set) || noop;
        }
        run(value);
        return () => {
            subscribers.delete(subscriber);
            if (subscribers.size === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}
function derived(stores, fn, initial_value) {
    const single = !Array.isArray(stores);
    const stores_array = single
        ? [stores]
        : stores;
    const auto = fn.length < 2;
    return readable(initial_value, (set) => {
        let inited = false;
        const values = [];
        let pending = 0;
        let cleanup = noop;
        const sync = () => {
            if (pending) {
                return;
            }
            cleanup();
            const result = fn(single ? values[0] : values, set);
            if (auto) {
                set(result);
            }
            else {
                cleanup = is_function(result) ? result : noop;
            }
        };
        const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
            values[i] = value;
            pending &= ~(1 << i);
            if (inited) {
                sync();
            }
        }, () => {
            pending |= (1 << i);
        }));
        inited = true;
        sync();
        return function stop() {
            run_all(unsubscribers);
            cleanup();
        };
    });
}

const LOCATION = {};
const ROUTER = {};

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

function getLocation(source) {
  return {
    ...source.location,
    state: source.history.state,
    key: (source.history.state && source.history.state.key) || "initial"
  };
}

function createHistory(source, options) {
  const listeners = [];
  let location = getLocation(source);

  return {
    get location() {
      return location;
    },

    listen(listener) {
      listeners.push(listener);

      const popstateListener = () => {
        location = getLocation(source);
        listener({ location, action: "POP" });
      };

      source.addEventListener("popstate", popstateListener);

      return () => {
        source.removeEventListener("popstate", popstateListener);

        const index = listeners.indexOf(listener);
        listeners.splice(index, 1);
      };
    },

    navigate(to, { state, replace = false } = {}) {
      state = { ...state, key: Date.now() + "" };
      // try...catch iOS Safari limits to 100 pushState calls
      try {
        if (replace) {
          source.history.replaceState(state, null, to);
        } else {
          source.history.pushState(state, null, to);
        }
      } catch (e) {
        source.location[replace ? "replace" : "assign"](to);
      }

      location = getLocation(source);
      listeners.forEach(listener => listener({ location, action: "PUSH" }));
    }
  };
}

// Stores history entries in memory for testing or other platforms like Native
function createMemorySource(initialPathname = "/") {
  let index = 0;
  const stack = [{ pathname: initialPathname, search: "" }];
  const states = [];

  return {
    get location() {
      return stack[index];
    },
    addEventListener(name, fn) {},
    removeEventListener(name, fn) {},
    history: {
      get entries() {
        return stack;
      },
      get index() {
        return index;
      },
      get state() {
        return states[index];
      },
      pushState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        index++;
        stack.push({ pathname, search });
        states.push(state);
      },
      replaceState(state, _, uri) {
        const [pathname, search = ""] = uri.split("?");
        stack[index] = { pathname, search };
        states[index] = state;
      }
    }
  };
}

// Global history uses window.history as the source if available,
// otherwise a memory history
const canUseDOM = Boolean(
  typeof window !== "undefined" &&
    window.document &&
    window.document.createElement
);
const globalHistory = createHistory(canUseDOM ? window : createMemorySource());

/**
 * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
 *
 * https://github.com/reach/router/blob/master/LICENSE
 * */

const paramRe = /^:(.+)/;

const SEGMENT_POINTS = 4;
const STATIC_POINTS = 3;
const DYNAMIC_POINTS = 2;
const SPLAT_PENALTY = 1;
const ROOT_POINTS = 1;

/**
 * Check if `string` starts with `search`
 * @param {string} string
 * @param {string} search
 * @return {boolean}
 */
function startsWith(string, search) {
  return string.substr(0, search.length) === search;
}

/**
 * Check if `segment` is a root segment
 * @param {string} segment
 * @return {boolean}
 */
function isRootSegment(segment) {
  return segment === "";
}

/**
 * Check if `segment` is a dynamic segment
 * @param {string} segment
 * @return {boolean}
 */
function isDynamic(segment) {
  return paramRe.test(segment);
}

/**
 * Check if `segment` is a splat
 * @param {string} segment
 * @return {boolean}
 */
function isSplat(segment) {
  return segment[0] === "*";
}

/**
 * Split up the URI into segments delimited by `/`
 * @param {string} uri
 * @return {string[]}
 */
function segmentize(uri) {
  return (
    uri
      // Strip starting/ending `/`
      .replace(/(^\/+|\/+$)/g, "")
      .split("/")
  );
}

/**
 * Strip `str` of potential start and end `/`
 * @param {string} str
 * @return {string}
 */
function stripSlashes(str) {
  return str.replace(/(^\/+|\/+$)/g, "");
}

/**
 * Score a route depending on how its individual segments look
 * @param {object} route
 * @param {number} index
 * @return {object}
 */
function rankRoute(route, index) {
  const score = route.default
    ? 0
    : segmentize(route.path).reduce((score, segment) => {
        score += SEGMENT_POINTS;

        if (isRootSegment(segment)) {
          score += ROOT_POINTS;
        } else if (isDynamic(segment)) {
          score += DYNAMIC_POINTS;
        } else if (isSplat(segment)) {
          score -= SEGMENT_POINTS + SPLAT_PENALTY;
        } else {
          score += STATIC_POINTS;
        }

        return score;
      }, 0);

  return { route, score, index };
}

/**
 * Give a score to all routes and sort them on that
 * @param {object[]} routes
 * @return {object[]}
 */
function rankRoutes(routes) {
  return (
    routes
      .map(rankRoute)
      // If two routes have the exact same score, we go by index instead
      .sort((a, b) =>
        a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
      )
  );
}

/**
 * Ranks and picks the best route to match. Each segment gets the highest
 * amount of points, then the type of segment gets an additional amount of
 * points where
 *
 *  static > dynamic > splat > root
 *
 * This way we don't have to worry about the order of our routes, let the
 * computers do it.
 *
 * A route looks like this
 *
 *  { path, default, value }
 *
 * And a returned match looks like:
 *
 *  { route, params, uri }
 *
 * @param {object[]} routes
 * @param {string} uri
 * @return {?object}
 */
function pick(routes, uri) {
  let match;
  let default_;

  const [uriPathname] = uri.split("?");
  const uriSegments = segmentize(uriPathname);
  const isRootUri = uriSegments[0] === "";
  const ranked = rankRoutes(routes);

  for (let i = 0, l = ranked.length; i < l; i++) {
    const route = ranked[i].route;
    let missed = false;

    if (route.default) {
      default_ = {
        route,
        params: {},
        uri
      };
      continue;
    }

    const routeSegments = segmentize(route.path);
    const params = {};
    const max = Math.max(uriSegments.length, routeSegments.length);
    let index = 0;

    for (; index < max; index++) {
      const routeSegment = routeSegments[index];
      const uriSegment = uriSegments[index];

      if (routeSegment !== undefined && isSplat(routeSegment)) {
        // Hit a splat, just grab the rest, and return a match
        // uri:   /files/documents/work
        // route: /files/* or /files/*splatname
        const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

        params[splatName] = uriSegments
          .slice(index)
          .map(decodeURIComponent)
          .join("/");
        break;
      }

      if (uriSegment === undefined) {
        // URI is shorter than the route, no match
        // uri:   /users
        // route: /users/:userId
        missed = true;
        break;
      }

      let dynamicMatch = paramRe.exec(routeSegment);

      if (dynamicMatch && !isRootUri) {
        const value = decodeURIComponent(uriSegment);
        params[dynamicMatch[1]] = value;
      } else if (routeSegment !== uriSegment) {
        // Current segments don't match, not dynamic, not splat, so no match
        // uri:   /users/123/settings
        // route: /users/:id/profile
        missed = true;
        break;
      }
    }

    if (!missed) {
      match = {
        route,
        params,
        uri: "/" + uriSegments.slice(0, index).join("/")
      };
      break;
    }
  }

  return match || default_ || null;
}

/**
 * Check if the `path` matches the `uri`.
 * @param {string} path
 * @param {string} uri
 * @return {?object}
 */
function match(route, uri) {
  return pick([route], uri);
}

/**
 * Add the query to the pathname if a query is given
 * @param {string} pathname
 * @param {string} [query]
 * @return {string}
 */
function addQuery(pathname, query) {
  return pathname + (query ? `?${query}` : "");
}

/**
 * Resolve URIs as though every path is a directory, no files. Relative URIs
 * in the browser can feel awkward because not only can you be "in a directory",
 * you can be "at a file", too. For example:
 *
 *  browserSpecResolve('foo', '/bar/') => /bar/foo
 *  browserSpecResolve('foo', '/bar') => /foo
 *
 * But on the command line of a file system, it's not as complicated. You can't
 * `cd` from a file, only directories. This way, links have to know less about
 * their current path. To go deeper you can do this:
 *
 *  <Link to="deeper"/>
 *  // instead of
 *  <Link to=`{${props.uri}/deeper}`/>
 *
 * Just like `cd`, if you want to go deeper from the command line, you do this:
 *
 *  cd deeper
 *  # not
 *  cd $(pwd)/deeper
 *
 * By treating every path as a directory, linking to relative paths should
 * require less contextual information and (fingers crossed) be more intuitive.
 * @param {string} to
 * @param {string} base
 * @return {string}
 */
function resolve(to, base) {
  // /foo/bar, /baz/qux => /foo/bar
  if (startsWith(to, "/")) {
    return to;
  }

  const [toPathname, toQuery] = to.split("?");
  const [basePathname] = base.split("?");
  const toSegments = segmentize(toPathname);
  const baseSegments = segmentize(basePathname);

  // ?a=b, /users?b=c => /users?a=b
  if (toSegments[0] === "") {
    return addQuery(basePathname, toQuery);
  }

  // profile, /users/789 => /users/789/profile
  if (!startsWith(toSegments[0], ".")) {
    const pathname = baseSegments.concat(toSegments).join("/");

    return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
  }

  // ./       , /users/123 => /users/123
  // ../      , /users/123 => /users
  // ../..    , /users/123 => /
  // ../../one, /a/b/c/d   => /a/b/one
  // .././one , /a/b/c/d   => /a/b/c/one
  const allSegments = baseSegments.concat(toSegments);
  const segments = [];

  allSegments.forEach(segment => {
    if (segment === "..") {
      segments.pop();
    } else if (segment !== ".") {
      segments.push(segment);
    }
  });

  return addQuery("/" + segments.join("/"), toQuery);
}

/**
 * Combines the `basepath` and the `path` into one path.
 * @param {string} basepath
 * @param {string} path
 */
function combinePaths(basepath, path) {
  return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
}

/* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.43.1 */

const Router = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $location, $$unsubscribe_location;
	let $routes, $$unsubscribe_routes;
	let $base, $$unsubscribe_base;
	let { basepath = "/" } = $$props;
	let { url = null } = $$props;
	const locationContext = getContext(LOCATION);
	const routerContext = getContext(ROUTER);
	const routes = writable([]);
	$$unsubscribe_routes = subscribe(routes, value => $routes = value);
	const activeRoute = writable(null);
	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

	// If locationContext is not set, this is the topmost Router in the tree.
	// If the `url` prop is given we force the location to it.
	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

	$$unsubscribe_location = subscribe(location, value => $location = value);

	// If routerContext is set, the routerBase of the parent Router
	// will be the base for this Router's descendants.
	// If routerContext is not set, the path and resolved uri will both
	// have the value of the basepath prop.
	const base = routerContext
	? routerContext.routerBase
	: writable({ path: basepath, uri: basepath });

	$$unsubscribe_base = subscribe(base, value => $base = value);

	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
		// If there is no activeRoute, the routerBase will be identical to the base.
		if (activeRoute === null) {
			return base;
		}

		const { path: basepath } = base;
		const { route, uri } = activeRoute;

		// Remove the potential /* or /*splatname from
		// the end of the child Routes relative paths.
		const path = route.default
		? basepath
		: route.path.replace(/\*.*$/, "");

		return { path, uri };
	});

	function registerRoute(route) {
		const { path: basepath } = $base;
		let { path } = route;

		// We store the original path in the _path property so we can reuse
		// it when the basepath changes. The only thing that matters is that
		// the route reference is intact, so mutation is fine.
		route._path = path;

		route.path = combinePaths(basepath, path);

		if (typeof window === "undefined") {
			// In SSR we should set the activeRoute immediately if it is a match.
			// If there are more Routes being registered after a match is found,
			// we just skip them.
			if (hasActiveRoute) {
				return;
			}

			const matchingRoute = match(route, $location.pathname);

			if (matchingRoute) {
				activeRoute.set(matchingRoute);
				hasActiveRoute = true;
			}
		} else {
			routes.update(rs => {
				rs.push(route);
				return rs;
			});
		}
	}

	function unregisterRoute(route) {
		routes.update(rs => {
			const index = rs.indexOf(route);
			rs.splice(index, 1);
			return rs;
		});
	}

	if (!locationContext) {
		// The topmost Router in the tree is responsible for updating
		// the location store and supplying it through context.
		onMount(() => {
			const unlisten = globalHistory.listen(history => {
				location.set(history.location);
			});

			return unlisten;
		});

		setContext(LOCATION, location);
	}

	setContext(ROUTER, {
		activeRoute,
		base,
		routerBase,
		registerRoute,
		unregisterRoute
	});

	if ($$props.basepath === void 0 && $$bindings.basepath && basepath !== void 0) $$bindings.basepath(basepath);
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);

	{
		{
			const { path: basepath } = $base;

			routes.update(rs => {
				rs.forEach(r => r.path = combinePaths(basepath, r._path));
				return rs;
			});
		}
	}

	{
		{
			const bestMatch = pick($routes, $location.pathname);
			activeRoute.set(bestMatch);
		}
	}

	$$unsubscribe_location();
	$$unsubscribe_routes();
	$$unsubscribe_base();
	return `${slots.default ? slots.default({}) : ``}`;
});

/* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.43.1 */

const Route = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let $activeRoute, $$unsubscribe_activeRoute;
	let $location, $$unsubscribe_location;
	let { path = "" } = $$props;
	let { component = null } = $$props;
	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
	$$unsubscribe_activeRoute = subscribe(activeRoute, value => $activeRoute = value);
	const location = getContext(LOCATION);
	$$unsubscribe_location = subscribe(location, value => $location = value);

	const route = {
		path,
		// If no path prop is given, this Route will act as the default Route
		// that is rendered if no other Route in the Router is a match.
		default: path === ""
	};

	let routeParams = {};
	let routeProps = {};
	registerRoute(route);

	// There is no need to unregister Routes in SSR since it will all be
	// thrown away anyway.
	if (typeof window !== "undefined") {
		onDestroy(() => {
			unregisterRoute(route);
		});
	}

	if ($$props.path === void 0 && $$bindings.path && path !== void 0) $$bindings.path(path);
	if ($$props.component === void 0 && $$bindings.component && component !== void 0) $$bindings.component(component);

	{
		if ($activeRoute && $activeRoute.route === route) {
			routeParams = $activeRoute.params;
		}
	}

	{
		{
			const { path, component, ...rest } = $$props;
			routeProps = rest;
		}
	}

	$$unsubscribe_activeRoute();
	$$unsubscribe_location();

	return `${$activeRoute !== null && $activeRoute.route === route
	? `${component !== null
		? `${validate_component(component || missing_component, "svelte:component").$$render($$result, Object.assign({ location: $location }, routeParams, routeProps), {}, {})}`
		: `${slots.default
			? slots.default({ params: routeParams, location: $location })
			: ``}`}`
	: ``}`;
});

/* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.43.1 */

const Link = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let ariaCurrent;
	let $$restProps = compute_rest_props($$props, ["to","replace","state","getProps"]);
	let $location, $$unsubscribe_location;
	let $base, $$unsubscribe_base;
	let { to = "#" } = $$props;
	let { replace = false } = $$props;
	let { state = {} } = $$props;
	let { getProps = () => ({}) } = $$props;
	const { base } = getContext(ROUTER);
	$$unsubscribe_base = subscribe(base, value => $base = value);
	const location = getContext(LOCATION);
	$$unsubscribe_location = subscribe(location, value => $location = value);
	createEventDispatcher();
	let href, isPartiallyCurrent, isCurrent, props;

	if ($$props.to === void 0 && $$bindings.to && to !== void 0) $$bindings.to(to);
	if ($$props.replace === void 0 && $$bindings.replace && replace !== void 0) $$bindings.replace(replace);
	if ($$props.state === void 0 && $$bindings.state && state !== void 0) $$bindings.state(state);
	if ($$props.getProps === void 0 && $$bindings.getProps && getProps !== void 0) $$bindings.getProps(getProps);
	href = to === "/" ? $base.uri : resolve(to, $base.uri);
	isPartiallyCurrent = startsWith($location.pathname, href);
	isCurrent = href === $location.pathname;
	ariaCurrent = isCurrent ? "page" : undefined;

	props = getProps({
		location: $location,
		href,
		isPartiallyCurrent,
		isCurrent
	});

	$$unsubscribe_location();
	$$unsubscribe_base();

	return `<a${spread([
		{ href: escape_attribute_value(href) },
		{
			"aria-current": escape_attribute_value(ariaCurrent)
		},
		escape_object(props),
		escape_object($$restProps)
	])}>${slots.default ? slots.default({}) : ``}</a>`;
});

/* src\routes\Home.svelte generated by Svelte v3.43.1 */

const css$6 = {
	code: "h1.svelte-1dxgcve{color:#9E0706}",
	map: "{\"version\":3,\"file\":\"Home.svelte\",\"sources\":[\"Home.svelte\"],\"sourcesContent\":[\"<main>\\r\\n    <h1>Уроки Svelte</h1>\\r\\n</main>\\r\\n\\r\\n<style>\\r\\n    h1 {\\r\\n        color: #9E0706;\\r\\n    }\\r\\n</style>\"],\"names\":[],\"mappings\":\"AAKI,EAAE,eAAC,CAAC,AACA,KAAK,CAAE,OAAO,AAClB,CAAC\"}"
};

const Home = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$6);

	return `<main><h1 class="${"svelte-1dxgcve"}">Уроки Svelte</h1>
</main>`;
});

/* src\routes\Variables.svelte generated by Svelte v3.43.1 */

const css$5 = {
	code: "h1{color:#F39102;text-align:center}img.svelte-8ss8j5{width:200px}",
	map: "{\"version\":3,\"file\":\"Variables.svelte\",\"sources\":[\"Variables.svelte\"],\"sourcesContent\":[\"<script>\\r\\n    let name = \\\"Svelte\\\"\\r\\n    let src = 'https://53news.ru/wp-content/uploads/2020/04/novgorodets-pozhalovalsya-na-soseda-kotoryj-zachem-to-derzhit-doma-gusya-2.jpg'\\r\\n    let altText = 'Гусь'\\r\\n    let number = 42\\r\\n    let htmlText = \\\"<strong>Гусь</strong> вот такой вот сидит\\\"\\r\\n</script>\\r\\n\\r\\n<style>\\r\\n    :global(h1) {\\r\\n        color: #F39102;\\r\\n        text-align: center;\\r\\n    }\\r\\n    img {\\r\\n        width: 200px;\\r\\n    }\\r\\n</style>\\r\\n\\r\\n<h1>Hello {name}</h1>\\r\\n<h2>{name.toUpperCase()}</h2>\\r\\n<h2>{(Math.random() * number).toFixed(0)}</h2>\\r\\n\\r\\n<img {src} alt=\\\"{altText}\\\">\\r\\n<img {src} alt=\\\"{altText}\\\">\\r\\n\\r\\n<p>{@html htmlText}</p>\"],\"names\":[],\"mappings\":\"AASY,EAAE,AAAE,CAAC,AACT,KAAK,CAAE,OAAO,CACd,UAAU,CAAE,MAAM,AACtB,CAAC,AACD,GAAG,cAAC,CAAC,AACD,KAAK,CAAE,KAAK,AAChB,CAAC\"}"
};

let name$1 = "Svelte";
let src = 'https://53news.ru/wp-content/uploads/2020/04/novgorodets-pozhalovalsya-na-soseda-kotoryj-zachem-to-derzhit-doma-gusya-2.jpg';
let altText = 'Гусь';
let number = 42;
let htmlText = "<strong>Гусь</strong> вот такой вот сидит";

const Variables = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	$$result.css.add(css$5);

	return `<h1>Hello ${escape(name$1)}</h1>
<h2>${escape(name$1.toUpperCase())}</h2>
<h2>${escape((Math.random() * number).toFixed(0))}</h2>

<img${add_attribute("src", src, 0)}${add_attribute("alt", altText, 0)} class="${"svelte-8ss8j5"}">
<img${add_attribute("src", src, 0)}${add_attribute("alt", altText, 0)} class="${"svelte-8ss8j5"}">

<p>${htmlText}</p>`;
});

/* src\components\NavLink.svelte generated by Svelte v3.43.1 */

function getProps({ location, href, isPartiallyCurrent, isCurrent }) {
	const isActive = href === "/"
	? isCurrent
	: isPartiallyCurrent || isCurrent;

	// The object returned here is spread on the anchor element's attributes
	if (isActive) {
		return { class: "active" };
	}

	return {};
}

const NavLink = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { to = "" } = $$props;
	if ($$props.to === void 0 && $$bindings.to && to !== void 0) $$bindings.to(to);

	return `${validate_component(Link, "Link").$$render($$result, { to, getProps }, {}, {
		default: () => `${slots.default ? slots.default({}) : ``}`
	})}`;
});

/* src\routes\Developments.svelte generated by Svelte v3.43.1 */

const css$4 = {
	code: ".playground.svelte-jahfhm{width:400px;height:200px;padding:1rem;margin-bottom:1rem;border:1px solid black}",
	map: "{\"version\":3,\"file\":\"Developments.svelte\",\"sources\":[\"Developments.svelte\"],\"sourcesContent\":[\"<script>\\r\\n    let name = \\\"Текст который изменится\\\"\\r\\n    const changeNameHandler = () =>  name = \\\"Текст поменялся\\\"\\r\\n    let pos = {\\r\\n        x: 0,\\r\\n        y: 0\\r\\n    }\\r\\n    const mouseMoveHandler = event => {\\r\\n        pos.x = event.x\\r\\n        pos.y = event.y\\r\\n    }\\r\\n    let inputValue = \\\"\\\"\\r\\n    const submitHandler = (event) => console.log(inputValue)\\r\\n</script>\\r\\n\\r\\n<h1>{name}</h1>\\r\\n<button on:click={changeNameHandler}>Поменять текст</button>\\r\\n<div class=\\\"playground\\\" on:mousemove={mouseMoveHandler}>X:{pos.x} Y:{pos.y}</div>\\r\\n\\r\\n<form action=\\\"\\\" on:submit|preventDefault|once={submitHandler}>\\r\\n    <input type=\\\"text\\\" on:input={event => (inputValue = event.target.value)}>\\r\\n    <button type=\\\"submit\\\">Отправить форму</button>\\r\\n</form>\\r\\n\\r\\n<style>\\r\\n    .playground {\\r\\n        width: 400px;\\r\\n        height: 200px;\\r\\n        padding: 1rem;\\r\\n        margin-bottom: 1rem;\\r\\n        border: 1px solid black;\\r\\n    }\\r\\n</style>\"],\"names\":[],\"mappings\":\"AAyBI,WAAW,cAAC,CAAC,AACT,KAAK,CAAE,KAAK,CACZ,MAAM,CAAE,KAAK,CACb,OAAO,CAAE,IAAI,CACb,aAAa,CAAE,IAAI,CACnB,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,AAC3B,CAAC\"}"
};

const Developments = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let name = "Текст который изменится";
	let pos = { x: 0, y: 0 };
	$$result.css.add(css$4);

	return `<h1>${escape(name)}</h1>
<button>Поменять текст</button>
<div class="${"playground svelte-jahfhm"}">X:${escape(pos.x)} Y:${escape(pos.y)}</div>

<form action="${""}"><input type="${"text"}">
    <button type="${"submit"}">Отправить форму</button>
</form>`;
});

/* src\routes\Reactivity.svelte generated by Svelte v3.43.1 */

const css$3 = {
	code: ".blue.svelte-19zh1pa{color:blue}.red.svelte-19zh1pa{color:#9E0706}",
	map: "{\"version\":3,\"file\":\"Reactivity.svelte\",\"sources\":[\"Reactivity.svelte\"],\"sourcesContent\":[\"<script>\\r\\n    let name = \\\"Svelte\\\"\\r\\n    let counter = 0\\r\\n\\r\\n    $: counterClass = counter % 2 === 0 ? 'red' : 'blue'\\r\\n\\r\\n    const changeName = () => name = \\\"new Name\\\"\\r\\n    $: upperName = name.toUpperCase()\\r\\n    $: lowerName = name.toLowerCase()\\r\\n\\r\\n    $: {\\r\\n        console.log('Name ', name)\\r\\n        console.log('Counter ', counter)\\r\\n    }\\r\\n\\r\\n    $: if (counter === 6) {\\r\\n        counter = 1\\r\\n    }\\r\\n\\r\\n    // first: for (let i = 0; i < 5; i++) {\\r\\n    //     if (i % 2 === 0) {\\r\\n    //         continue first;\\r\\n    //     }\\r\\n    // }\\r\\n\\r\\n</script>\\r\\n\\r\\n<h1>{name}</h1>\\r\\n<h2>{upperName}</h2>\\r\\n<h2>{lowerName}</h2>\\r\\n<button on:click={changeName}>Поменять текст</button>\\r\\n<h1 class={counterClass}>Counter: {counter}</h1>\\r\\n<button on:click={() => counter++}>Add 1 to counter</button>\\r\\n<style>\\r\\n    .blue {\\r\\n        color: blue;\\r\\n    }\\r\\n    .red {\\r\\n        color: #9E0706;\\r\\n    }\\r\\n</style>\"],\"names\":[],\"mappings\":\"AAkCI,KAAK,eAAC,CAAC,AACH,KAAK,CAAE,IAAI,AACf,CAAC,AACD,IAAI,eAAC,CAAC,AACF,KAAK,CAAE,OAAO,AAClB,CAAC\"}"
};

const Reactivity = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let counterClass;
	let upperName;
	let lowerName;
	let name = "Svelte";
	let counter = 0;
	$$result.css.add(css$3);

	counterClass = 'red' ;
	upperName = name.toUpperCase();
	lowerName = name.toLowerCase();

	{
		{
			console.log('Name ', name);
			console.log('Counter ', counter);
		}
	}

	return `<h1>${escape(name)}</h1>
<h2>${escape(upperName)}</h2>
<h2>${escape(lowerName)}</h2>
<button>Поменять текст</button>
<h1 class="${escape(null_to_empty(counterClass)) + " svelte-19zh1pa"}">Counter: ${escape(counter)}</h1>
<button>Add 1 to counter</button>`;
});

/* src\routes\Bind.svelte generated by Svelte v3.43.1 */

const Bind = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let name = "Svelte";
	let agree = false;
	let text = "";
	let sex = "Male";

	return `<h1>${escape(name)}</h1>

<input type="${"text"}"${add_attribute("value", name, 0)}>
<hr>
<input type="${"checkbox"}"${add_attribute("checked", agree, 1)}> ${escape(agree)}
<hr>
<textarea name="${""}" id="${""}" cols="${"30"}" rows="${"10"}">${""}</textarea>
<div style="${"white-space: pre-wrap"}">${escape(text)}</div>
<hr>
<select><option value="${"0"}">Option 0</option><option value="${"1"}">Option 1</option><option value="${"2"}">Option 2</option></select>
<hr>
<input type="${"radio"}" value="${"female"}"${""}> Female
<input type="${"radio"}" value="${"male"}"${""}> Male
<br>
Sex: ${escape(sex)}`;
});

/* src\routes\IfElse.svelte generated by Svelte v3.43.1 */

const css$2 = {
	code: "input.svelte-1w8191u{outline:none}.red.svelte-1w8191u{border-color:#9E0706}.green.svelte-1w8191u{border-color:#84fab0}",
	map: "{\"version\":3,\"file\":\"IfElse.svelte\",\"sources\":[\"IfElse.svelte\"],\"sourcesContent\":[\"<script>\\r\\n    let value = \\\"Hello\\\"\\r\\n\\r\\n    $: error = !isValid(value)\\r\\n\\r\\n    function isValid(val) {\\r\\n        return val.length >= 5 && val.length < 10;\\r\\n    }\\r\\n\\r\\n</script>\\r\\n\\r\\n<h1>Application</h1>\\r\\n\\r\\n<input type=\\\"text\\\" bind:value class:red={error} class:green={!error}>\\r\\n\\r\\n{#if value.length < 5}\\r\\n    <p>Длинна меньше 5 символов</p>\\r\\n{:else if value.length > 10}\\r\\n    <p>Длинна больше 10 символов</p>\\r\\n{:else}\\r\\n    <p>Длинна между 5 и 10</p>\\r\\n{/if}\\r\\n\\r\\n<style>\\r\\n    input {\\r\\n        outline: none;\\r\\n    }\\r\\n    .red {\\r\\n        border-color: #9E0706;\\r\\n    }\\r\\n\\r\\n    .green {\\r\\n        border-color: #84fab0;\\r\\n    }\\r\\n</style>\"],\"names\":[],\"mappings\":\"AAwBI,KAAK,eAAC,CAAC,AACH,OAAO,CAAE,IAAI,AACjB,CAAC,AACD,IAAI,eAAC,CAAC,AACF,YAAY,CAAE,OAAO,AACzB,CAAC,AAED,MAAM,eAAC,CAAC,AACJ,YAAY,CAAE,OAAO,AACzB,CAAC\"}"
};

function isValid(val) {
	return val.length >= 5 && val.length < 10;
}

const IfElse = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let error;
	let value = "Hello";
	$$result.css.add(css$2);
	error = !isValid(value);

	return `<h1>Application</h1>

<input type="${"text"}" class="${["svelte-1w8191u", (error ? "red" : "") + ' ' + (!error ? "green" : "")].join(' ').trim()}"${add_attribute("value", value, 0)}>

${value.length < 5
	? `<p>Длинна меньше 5 символов</p>`
	: `${value.length > 10
		? `<p>Длинна больше 10 символов</p>`
		: `<p>Длинна между 5 и 10</p>`}`}`;
});

/* src\components\Person.svelte generated by Svelte v3.43.1 */

const css$1 = {
	code: "div.svelte-thfj3{border:1px solid black;padding:1rem;margin-bottom:1rem}",
	map: "{\"version\":3,\"file\":\"Person.svelte\",\"sources\":[\"Person.svelte\"],\"sourcesContent\":[\"<script>\\r\\n    export let name = 'Undefined name'\\r\\n    export let age = 'Undefined age'\\r\\n    export let job = 'Undefined job'\\r\\n    export let index = '1'\\r\\n\\r\\n   let copy = name\\r\\n</script>\\r\\n\\r\\n<style>\\r\\n    div {\\r\\n        border: 1px solid black;\\r\\n        padding: 1rem;\\r\\n        margin-bottom: 1rem;\\r\\n    }\\r\\n</style>\\r\\n\\r\\n<div>\\r\\n    <p>№ {index+1}</p>\\r\\n    <p>Имя: <strong>{name}</strong> / {copy}</p>\\r\\n    <p>Занятие: <strong>{job}</strong></p>\\r\\n\\r\\n    {#if age < 18}\\r\\n        <p>Пиво продавать нельзя</p>\\r\\n    {:else}\\r\\n        <p>Делай что хочешь</p>\\r\\n    {/if}\\r\\n\\r\\n</div>\"],\"names\":[],\"mappings\":\"AAUI,GAAG,aAAC,CAAC,AACD,MAAM,CAAE,GAAG,CAAC,KAAK,CAAC,KAAK,CACvB,OAAO,CAAE,IAAI,CACb,aAAa,CAAE,IAAI,AACvB,CAAC\"}"
};

const Person = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { name = 'Undefined name' } = $$props;
	let { age = 'Undefined age' } = $$props;
	let { job = 'Undefined job' } = $$props;
	let { index = '1' } = $$props;
	let copy = name;
	if ($$props.name === void 0 && $$bindings.name && name !== void 0) $$bindings.name(name);
	if ($$props.age === void 0 && $$bindings.age && age !== void 0) $$bindings.age(age);
	if ($$props.job === void 0 && $$bindings.job && job !== void 0) $$bindings.job(job);
	if ($$props.index === void 0 && $$bindings.index && index !== void 0) $$bindings.index(index);
	$$result.css.add(css$1);

	return `<div class="${"svelte-thfj3"}"><p>№ ${escape(index + 1)}</p>
    <p>Имя: <strong>${escape(name)}</strong> / ${escape(copy)}</p>
    <p>Занятие: <strong>${escape(job)}</strong></p>

    ${age < 18
	? `<p>Пиво продавать нельзя</p>`
	: `<p>Делай что хочешь</p>`}</div>`;
});

/* src\routes\Components.svelte generated by Svelte v3.43.1 */
let name = 'Igor';
let age = 20;
let job = 'Backend';

const Components = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let people = [
		{
			id: 1,
			name: 'Максим',
			age: 24,
			job: 'Frontend'
		},
		{
			id: 2,
			name: 'Елена',
			age: 17,
			job: 'Student'
		}
	];

	return `<h1>Application</h1>

${validate_component(Person, "Person").$$render(
		$$result,
		{
			name: people[0].name,
			age: people[0].age,
			job: people[0].job
		},
		{},
		{}
	)}

${validate_component(Person, "Person").$$render($$result, Object.assign(people[1]), {}, {})}
${validate_component(Person, "Person").$$render($$result, { name, age, job }, {}, {})}`;
});

/* src\routes\Cycle.svelte generated by Svelte v3.43.1 */

const Cycle = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let people = [
		{
			id: 1,
			name: 'Максим',
			age: 24,
			job: 'Frontend'
		},
		{
			id: 2,
			name: 'Елена',
			age: 17,
			job: 'Student'
		}
	];

	let value = "";
	let age = "";
	let job = "";

	return `<h1>Циклы</h1>

<input type="${"text"}" placeholder="${"Имя"}"${add_attribute("value", value, 0)}>
<input type="${"text"}" placeholder="${"Возраст"}"${add_attribute("value", age, 0)}>
<input type="${"text"}" placeholder="${"Job"}"${add_attribute("value", job, 0)}>
<button>Добавить человека</button>
<button>Удалить первого человека</button>
<hr>

${people.length
	? each(people, ({ name, age, job, id }, i) => `
    ${validate_component(Person, "Person").$$render($$result, { name, age, job, index: i }, {}, {})}`)
	: `<p>Людей не осталось</p>`}`;
});

/* src\App.svelte generated by Svelte v3.43.1 */

const css = {
	code: ".container.svelte-8k82ra{width:1200px;margin:0 auto}",
	map: "{\"version\":3,\"file\":\"App.svelte\",\"sources\":[\"App.svelte\"],\"sourcesContent\":[\"<!-- App.svelte -->\\n<script>\\n\\timport { Router, Route } from \\\"svelte-routing\\\";\\n\\timport Home from \\\"./routes/Home.svelte\\\";\\n\\timport Variables from \\\"./routes/Variables.svelte\\\";\\n\\timport NavLink from \\\"./components/NavLink.svelte\\\";\\n\\timport Developments from \\\"./routes/Developments.svelte\\\";\\n\\timport Reactivity from \\\"./routes/Reactivity.svelte\\\";\\n\\timport Bind from \\\"./routes/Bind.svelte\\\";\\n\\timport IfElse from \\\"./routes/IfElse.svelte\\\";\\n\\timport Components from \\\"./routes/Components.svelte\\\";\\n\\timport Cycle from \\\"./routes/Cycle.svelte\\\";\\n\\n\\texport let url = \\\"\\\";\\n</script>\\n\\n<div class=\\\"container\\\">\\n\\t<main>\\n\\t\\t<Router url=\\\"{url}\\\">\\n\\t\\t\\t<nav>\\n\\t\\t\\t\\t<NavLink to=\\\"/\\\">Home</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"variables\\\">Переменные</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"developments\\\">События</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"reactivity\\\">Реактивность</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"bind\\\">bind</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"ifelse\\\">Условные операторы</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"components\\\">Компоненты</NavLink>\\n\\t\\t\\t\\t<NavLink to=\\\"cycle\\\">Циклы</NavLink>\\n\\t\\t\\t</nav>\\n\\t\\t\\t<div>\\n\\t\\t\\t\\t<Route path=\\\"variables\\\" component=\\\"{Variables}\\\" />\\n\\t\\t\\t\\t<Route path=\\\"/\\\"><Home /></Route>\\n\\t\\t\\t\\t<Route path=\\\"/developments\\\"><Developments /></Route>\\n\\t\\t\\t\\t<Route path=\\\"/reactivity\\\"><Reactivity /></Route>\\n\\t\\t\\t\\t<Route path=\\\"/bind\\\"><Bind /></Route>\\n\\t\\t\\t\\t<Route path=\\\"/ifelse\\\"><IfElse /></Route>\\n\\t\\t\\t\\t<Route path=\\\"/components\\\"><Components /></Route>\\n\\t\\t\\t\\t<Route path=\\\"/cycle\\\"><Cycle /></Route>\\n\\t\\t\\t</div>\\n\\t\\t</Router>\\n\\t</main>\\n</div>\\n\\n<style>\\n\\t.container {\\n\\t\\twidth: 1200px;\\n\\t\\tmargin: 0 auto;\\n\\t}\\n</style>\"],\"names\":[],\"mappings\":\"AA4CC,UAAU,cAAC,CAAC,AACX,KAAK,CAAE,MAAM,CACb,MAAM,CAAE,CAAC,CAAC,IAAI,AACf,CAAC\"}"
};

const App = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { url = "" } = $$props;
	if ($$props.url === void 0 && $$bindings.url && url !== void 0) $$bindings.url(url);
	$$result.css.add(css);

	return `


<div class="${"container svelte-8k82ra"}"><main>${validate_component(Router, "Router").$$render($$result, { url }, {}, {
		default: () => `<nav>${validate_component(NavLink, "NavLink").$$render($$result, { to: "/" }, {}, { default: () => `Home` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "variables" }, {}, { default: () => `Переменные` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "developments" }, {}, { default: () => `События` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "reactivity" }, {}, { default: () => `Реактивность` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "bind" }, {}, { default: () => `bind` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "ifelse" }, {}, { default: () => `Условные операторы` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "components" }, {}, { default: () => `Компоненты` })}
				${validate_component(NavLink, "NavLink").$$render($$result, { to: "cycle" }, {}, { default: () => `Циклы` })}</nav>
			<div>${validate_component(Route, "Route").$$render($$result, { path: "variables", component: Variables }, {}, {})}
				${validate_component(Route, "Route").$$render($$result, { path: "/" }, {}, {
			default: () => `${validate_component(Home, "Home").$$render($$result, {}, {}, {})}`
		})}
				${validate_component(Route, "Route").$$render($$result, { path: "/developments" }, {}, {
			default: () => `${validate_component(Developments, "Developments").$$render($$result, {}, {}, {})}`
		})}
				${validate_component(Route, "Route").$$render($$result, { path: "/reactivity" }, {}, {
			default: () => `${validate_component(Reactivity, "Reactivity").$$render($$result, {}, {}, {})}`
		})}
				${validate_component(Route, "Route").$$render($$result, { path: "/bind" }, {}, {
			default: () => `${validate_component(Bind, "Bind").$$render($$result, {}, {}, {})}`
		})}
				${validate_component(Route, "Route").$$render($$result, { path: "/ifelse" }, {}, {
			default: () => `${validate_component(IfElse, "IfElse").$$render($$result, {}, {}, {})}`
		})}
				${validate_component(Route, "Route").$$render($$result, { path: "/components" }, {}, {
			default: () => `${validate_component(Components, "Components").$$render($$result, {}, {}, {})}`
		})}
				${validate_component(Route, "Route").$$render($$result, { path: "/cycle" }, {}, {
			default: () => `${validate_component(Cycle, "Cycle").$$render($$result, {}, {}, {})}`
		})}</div>`
	})}</main>
</div>`;
});

module.exports = App;
