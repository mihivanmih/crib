
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35730/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
(function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
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

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function outro_and_destroy_block(block, lookup) {
        transition_out(block, 1, 1, () => {
            lookup.delete(block.key);
        });
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
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
    const { navigate } = globalHistory;

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

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    /* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.43.1 */

    function create_fragment$d(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		l(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	component_subscribe($$self, base, value => $$invalidate(7, $base = value));

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

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 128) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 96) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		$location,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$b, create_fragment$d, safe_not_equal, { basepath: 3, url: 4 });
    	}
    }

    /* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.43.1 */

    const get_default_slot_changes = dirty => ({
    	params: dirty & /*routeParams*/ 4,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context = ctx => ({
    	params: /*routeParams*/ ctx[2],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$1, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	return {
    		c() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (43:2) {:else}
    function create_else_block$3(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		l(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams, $location*/ 532)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    // (41:2) {#if component !== null}
    function create_if_block_1$1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[2],
    		/*routeProps*/ ctx[3]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return { props: switch_instance_props };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	return {
    		c() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 28)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};
    }

    function create_fragment$c(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$2(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

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

    	$$self.$$set = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 2) {
    			if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(2, routeParams = $activeRoute.params);
    			}
    		}

    		{
    			const { path, component, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$a, create_fragment$c, safe_not_equal, { path: 8, component: 0 });
    	}
    }

    /* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.43.1 */

    function create_fragment$b(ctx) {
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1],
    		/*$$restProps*/ ctx[6]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	return {
    		c() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l(nodes) {
    			a = claim_element(nodes, "A", { href: true, "aria-current": true });
    			var a_nodes = children(a);
    			if (default_slot) default_slot.l(a_nodes);
    			a_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			set_attributes(a, a_data);
    		},
    		m(target, anchor) {
    			insert_hydration(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(a, "click", /*onClick*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[15],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[15])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null),
    						null
    					);
    				}
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				(!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
    				(!current || dirty & /*ariaCurrent*/ 4) && { "aria-current": /*ariaCurrent*/ ctx[2] },
    				dirty & /*props*/ 2 && /*props*/ ctx[1],
    				dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
    			]));
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let ariaCurrent;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	component_subscribe($$self, base, value => $$invalidate(14, $base = value));
    	const location = getContext(LOCATION);
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = $location.pathname === href || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('to' in $$new_props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$new_props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$new_props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$new_props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('$$scope' in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 16512) {
    			$$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			$$invalidate(11, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			$$invalidate(12, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 4096) {
    			$$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 15361) {
    			$$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		$$restProps,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$location,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Link extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance$9, create_fragment$b, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});
    	}
    }

    /* src\routes\Home.svelte generated by Svelte v3.43.1 */

    function create_fragment$a(ctx) {
    	let main;
    	let h1;
    	let t;

    	return {
    		c() {
    			main = element("main");
    			h1 = element("h1");
    			t = text("Уроки Svelte");
    			this.h();
    		},
    		l(nodes) {
    			main = claim_element(nodes, "MAIN", {});
    			var main_nodes = children(main);
    			h1 = claim_element(main_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t = claim_text(h1_nodes, "Уроки Svelte");
    			h1_nodes.forEach(detach);
    			main_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(h1, "class", "svelte-1dxgcve");
    		},
    		m(target, anchor) {
    			insert_hydration(target, main, anchor);
    			append_hydration(main, h1);
    			append_hydration(h1, t);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    		}
    	};
    }

    class Home extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$a, safe_not_equal, {});
    	}
    }

    /* src\routes\Variables.svelte generated by Svelte v3.43.1 */

    function create_fragment$9(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let t2;
    	let h20;
    	let t3_value = name$1.toUpperCase() + "";
    	let t3;
    	let t4;
    	let h21;
    	let t5_value = (Math.random() * number).toFixed(0) + "";
    	let t5;
    	let t6;
    	let img0;
    	let img0_src_value;
    	let t7;
    	let img1;
    	let img1_src_value;
    	let t8;
    	let p;

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text("Hello ");
    			t1 = text(name$1);
    			t2 = space();
    			h20 = element("h2");
    			t3 = text(t3_value);
    			t4 = space();
    			h21 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			img0 = element("img");
    			t7 = space();
    			img1 = element("img");
    			t8 = space();
    			p = element("p");
    			this.h();
    		},
    		l(nodes) {
    			h1 = claim_element(nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Hello ");
    			t1 = claim_text(h1_nodes, name$1);
    			h1_nodes.forEach(detach);
    			t2 = claim_space(nodes);
    			h20 = claim_element(nodes, "H2", {});
    			var h20_nodes = children(h20);
    			t3 = claim_text(h20_nodes, t3_value);
    			h20_nodes.forEach(detach);
    			t4 = claim_space(nodes);
    			h21 = claim_element(nodes, "H2", {});
    			var h21_nodes = children(h21);
    			t5 = claim_text(h21_nodes, t5_value);
    			h21_nodes.forEach(detach);
    			t6 = claim_space(nodes);
    			img0 = claim_element(nodes, "IMG", { src: true, alt: true, class: true });
    			t7 = claim_space(nodes);
    			img1 = claim_element(nodes, "IMG", { src: true, alt: true, class: true });
    			t8 = claim_space(nodes);
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			p_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			if (!src_url_equal(img0.src, img0_src_value = src)) attr(img0, "src", img0_src_value);
    			attr(img0, "alt", altText);
    			attr(img0, "class", "svelte-8ss8j5");
    			if (!src_url_equal(img1.src, img1_src_value = src)) attr(img1, "src", img1_src_value);
    			attr(img1, "alt", altText);
    			attr(img1, "class", "svelte-8ss8j5");
    		},
    		m(target, anchor) {
    			insert_hydration(target, h1, anchor);
    			append_hydration(h1, t0);
    			append_hydration(h1, t1);
    			insert_hydration(target, t2, anchor);
    			insert_hydration(target, h20, anchor);
    			append_hydration(h20, t3);
    			insert_hydration(target, t4, anchor);
    			insert_hydration(target, h21, anchor);
    			append_hydration(h21, t5);
    			insert_hydration(target, t6, anchor);
    			insert_hydration(target, img0, anchor);
    			insert_hydration(target, t7, anchor);
    			insert_hydration(target, img1, anchor);
    			insert_hydration(target, t8, anchor);
    			insert_hydration(target, p, anchor);
    			p.innerHTML = htmlText;
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t2);
    			if (detaching) detach(h20);
    			if (detaching) detach(t4);
    			if (detaching) detach(h21);
    			if (detaching) detach(t6);
    			if (detaching) detach(img0);
    			if (detaching) detach(t7);
    			if (detaching) detach(img1);
    			if (detaching) detach(t8);
    			if (detaching) detach(p);
    		}
    	};
    }

    let name$1 = "Svelte";
    let src = 'https://53news.ru/wp-content/uploads/2020/04/novgorodets-pozhalovalsya-na-soseda-kotoryj-zachem-to-derzhit-doma-gusya-2.jpg';
    let altText = 'Гусь';
    let number = 42;
    let htmlText = "<strong>Гусь</strong> вот такой вот сидит";

    class Variables extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$9, safe_not_equal, {});
    	}
    }

    /* src\components\NavLink.svelte generated by Svelte v3.43.1 */

    function create_default_slot$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[1].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	return {
    		c() {
    			if (default_slot) default_slot.c();
    		},
    		l(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};
    }

    function create_fragment$8(ctx) {
    	let link;
    	let current;

    	link = new Link({
    			props: {
    				to: /*to*/ ctx[0],
    				getProps,
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			create_component(link.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(link.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(link, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const link_changes = {};
    			if (dirty & /*to*/ 1) link_changes.to = /*to*/ ctx[0];

    			if (dirty & /*$$scope*/ 4) {
    				link_changes.$$scope = { dirty, ctx };
    			}

    			link.$set(link_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(link.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(link.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(link, detaching);
    		}
    	};
    }

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

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	let { to = "" } = $$props;

    	$$self.$$set = $$props => {
    		if ('to' in $$props) $$invalidate(0, to = $$props.to);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	return [to, slots, $$scope];
    }

    class NavLink extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { to: 0 });
    	}
    }

    /* src\routes\Developments.svelte generated by Svelte v3.43.1 */

    function create_fragment$7(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let button0;
    	let t2;
    	let t3;
    	let div;
    	let t4;
    	let t5_value = /*pos*/ ctx[1].x + "";
    	let t5;
    	let t6;
    	let t7_value = /*pos*/ ctx[1].y + "";
    	let t7;
    	let t8;
    	let form;
    	let input;
    	let t9;
    	let button1;
    	let t10;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			button0 = element("button");
    			t2 = text("Поменять текст");
    			t3 = space();
    			div = element("div");
    			t4 = text("X:");
    			t5 = text(t5_value);
    			t6 = text(" Y:");
    			t7 = text(t7_value);
    			t8 = space();
    			form = element("form");
    			input = element("input");
    			t9 = space();
    			button1 = element("button");
    			t10 = text("Отправить форму");
    			this.h();
    		},
    		l(nodes) {
    			h1 = claim_element(nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, /*name*/ ctx[0]);
    			h1_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			button0 = claim_element(nodes, "BUTTON", {});
    			var button0_nodes = children(button0);
    			t2 = claim_text(button0_nodes, "Поменять текст");
    			button0_nodes.forEach(detach);
    			t3 = claim_space(nodes);
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t4 = claim_text(div_nodes, "X:");
    			t5 = claim_text(div_nodes, t5_value);
    			t6 = claim_text(div_nodes, " Y:");
    			t7 = claim_text(div_nodes, t7_value);
    			div_nodes.forEach(detach);
    			t8 = claim_space(nodes);
    			form = claim_element(nodes, "FORM", { action: true });
    			var form_nodes = children(form);
    			input = claim_element(form_nodes, "INPUT", { type: true });
    			t9 = claim_space(form_nodes);
    			button1 = claim_element(form_nodes, "BUTTON", { type: true });
    			var button1_nodes = children(button1);
    			t10 = claim_text(button1_nodes, "Отправить форму");
    			button1_nodes.forEach(detach);
    			form_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "playground svelte-jahfhm");
    			attr(input, "type", "text");
    			attr(button1, "type", "submit");
    			attr(form, "action", "");
    		},
    		m(target, anchor) {
    			insert_hydration(target, h1, anchor);
    			append_hydration(h1, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, button0, anchor);
    			append_hydration(button0, t2);
    			insert_hydration(target, t3, anchor);
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t4);
    			append_hydration(div, t5);
    			append_hydration(div, t6);
    			append_hydration(div, t7);
    			insert_hydration(target, t8, anchor);
    			insert_hydration(target, form, anchor);
    			append_hydration(form, input);
    			append_hydration(form, t9);
    			append_hydration(form, button1);
    			append_hydration(button1, t10);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*changeNameHandler*/ ctx[3]),
    					listen(div, "mousemove", /*mouseMoveHandler*/ ctx[4]),
    					listen(input, "input", /*input_handler*/ ctx[6]),
    					listen(form, "submit", prevent_default(/*submitHandler*/ ctx[5]), { once: true })
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data(t0, /*name*/ ctx[0]);
    			if (dirty & /*pos*/ 2 && t5_value !== (t5_value = /*pos*/ ctx[1].x + "")) set_data(t5, t5_value);
    			if (dirty & /*pos*/ 2 && t7_value !== (t7_value = /*pos*/ ctx[1].y + "")) set_data(t7, t7_value);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(button0);
    			if (detaching) detach(t3);
    			if (detaching) detach(div);
    			if (detaching) detach(t8);
    			if (detaching) detach(form);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let name = "Текст который изменится";
    	const changeNameHandler = () => $$invalidate(0, name = "Текст поменялся");
    	let pos = { x: 0, y: 0 };

    	const mouseMoveHandler = event => {
    		$$invalidate(1, pos.x = event.x, pos);
    		$$invalidate(1, pos.y = event.y, pos);
    	};

    	let inputValue = "";
    	const submitHandler = event => console.log(inputValue);
    	const input_handler = event => $$invalidate(2, inputValue = event.target.value);

    	return [
    		name,
    		pos,
    		inputValue,
    		changeNameHandler,
    		mouseMoveHandler,
    		submitHandler,
    		input_handler
    	];
    }

    class Developments extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});
    	}
    }

    /* src\routes\Reactivity.svelte generated by Svelte v3.43.1 */

    function create_fragment$6(ctx) {
    	let h10;
    	let t0;
    	let t1;
    	let h20;
    	let t2;
    	let t3;
    	let h21;
    	let t4;
    	let t5;
    	let button0;
    	let t6;
    	let t7;
    	let h11;
    	let t8;
    	let t9;
    	let h11_class_value;
    	let t10;
    	let button1;
    	let t11;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			h10 = element("h1");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			h20 = element("h2");
    			t2 = text(/*upperName*/ ctx[3]);
    			t3 = space();
    			h21 = element("h2");
    			t4 = text(/*lowerName*/ ctx[2]);
    			t5 = space();
    			button0 = element("button");
    			t6 = text("Поменять текст");
    			t7 = space();
    			h11 = element("h1");
    			t8 = text("Counter: ");
    			t9 = text(/*counter*/ ctx[1]);
    			t10 = space();
    			button1 = element("button");
    			t11 = text("Add 1 to counter");
    			this.h();
    		},
    		l(nodes) {
    			h10 = claim_element(nodes, "H1", {});
    			var h10_nodes = children(h10);
    			t0 = claim_text(h10_nodes, /*name*/ ctx[0]);
    			h10_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			h20 = claim_element(nodes, "H2", {});
    			var h20_nodes = children(h20);
    			t2 = claim_text(h20_nodes, /*upperName*/ ctx[3]);
    			h20_nodes.forEach(detach);
    			t3 = claim_space(nodes);
    			h21 = claim_element(nodes, "H2", {});
    			var h21_nodes = children(h21);
    			t4 = claim_text(h21_nodes, /*lowerName*/ ctx[2]);
    			h21_nodes.forEach(detach);
    			t5 = claim_space(nodes);
    			button0 = claim_element(nodes, "BUTTON", {});
    			var button0_nodes = children(button0);
    			t6 = claim_text(button0_nodes, "Поменять текст");
    			button0_nodes.forEach(detach);
    			t7 = claim_space(nodes);
    			h11 = claim_element(nodes, "H1", { class: true });
    			var h11_nodes = children(h11);
    			t8 = claim_text(h11_nodes, "Counter: ");
    			t9 = claim_text(h11_nodes, /*counter*/ ctx[1]);
    			h11_nodes.forEach(detach);
    			t10 = claim_space(nodes);
    			button1 = claim_element(nodes, "BUTTON", {});
    			var button1_nodes = children(button1);
    			t11 = claim_text(button1_nodes, "Add 1 to counter");
    			button1_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(h11, "class", h11_class_value = "" + (null_to_empty(/*counterClass*/ ctx[4]) + " svelte-19zh1pa"));
    		},
    		m(target, anchor) {
    			insert_hydration(target, h10, anchor);
    			append_hydration(h10, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, h20, anchor);
    			append_hydration(h20, t2);
    			insert_hydration(target, t3, anchor);
    			insert_hydration(target, h21, anchor);
    			append_hydration(h21, t4);
    			insert_hydration(target, t5, anchor);
    			insert_hydration(target, button0, anchor);
    			append_hydration(button0, t6);
    			insert_hydration(target, t7, anchor);
    			insert_hydration(target, h11, anchor);
    			append_hydration(h11, t8);
    			append_hydration(h11, t9);
    			insert_hydration(target, t10, anchor);
    			insert_hydration(target, button1, anchor);
    			append_hydration(button1, t11);

    			if (!mounted) {
    				dispose = [
    					listen(button0, "click", /*changeName*/ ctx[5]),
    					listen(button1, "click", /*click_handler*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data(t0, /*name*/ ctx[0]);
    			if (dirty & /*upperName*/ 8) set_data(t2, /*upperName*/ ctx[3]);
    			if (dirty & /*lowerName*/ 4) set_data(t4, /*lowerName*/ ctx[2]);
    			if (dirty & /*counter*/ 2) set_data(t9, /*counter*/ ctx[1]);

    			if (dirty & /*counterClass*/ 16 && h11_class_value !== (h11_class_value = "" + (null_to_empty(/*counterClass*/ ctx[4]) + " svelte-19zh1pa"))) {
    				attr(h11, "class", h11_class_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h10);
    			if (detaching) detach(t1);
    			if (detaching) detach(h20);
    			if (detaching) detach(t3);
    			if (detaching) detach(h21);
    			if (detaching) detach(t5);
    			if (detaching) detach(button0);
    			if (detaching) detach(t7);
    			if (detaching) detach(h11);
    			if (detaching) detach(t10);
    			if (detaching) detach(button1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let counterClass;
    	let upperName;
    	let lowerName;
    	let name = "Svelte";
    	let counter = 0;
    	const changeName = () => $$invalidate(0, name = "new Name");
    	const click_handler = () => $$invalidate(1, counter++, counter);

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*counter*/ 2) {
    			if (counter === 6) {
    				$$invalidate(1, counter = 1);
    			}
    		}

    		if ($$self.$$.dirty & /*counter*/ 2) {
    			$$invalidate(4, counterClass = counter % 2 === 0 ? 'red' : 'blue');
    		}

    		if ($$self.$$.dirty & /*name*/ 1) {
    			$$invalidate(3, upperName = name.toUpperCase());
    		}

    		if ($$self.$$.dirty & /*name*/ 1) {
    			$$invalidate(2, lowerName = name.toLowerCase());
    		}

    		if ($$self.$$.dirty & /*name, counter*/ 3) {
    			{
    				console.log('Name ', name);
    				console.log('Counter ', counter);
    			}
    		}
    	};

    	return [name, counter, lowerName, upperName, counterClass, changeName, click_handler];
    }

    class Reactivity extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});
    	}
    }

    /* src\routes\Bind.svelte generated by Svelte v3.43.1 */

    function create_fragment$5(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let input0;
    	let t2;
    	let hr0;
    	let t3;
    	let input1;
    	let t4;
    	let t5;
    	let t6;
    	let hr1;
    	let t7;
    	let textarea;
    	let t8;
    	let div;
    	let t9;
    	let t10;
    	let hr2;
    	let t11;
    	let select_1;
    	let option0;
    	let t12;
    	let option1;
    	let t13;
    	let option2;
    	let t14;
    	let t15;
    	let hr3;
    	let t16;
    	let input2;
    	let t17;
    	let input3;
    	let t18;
    	let br;
    	let t19;
    	let t20;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text(/*name*/ ctx[0]);
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			hr0 = element("hr");
    			t3 = space();
    			input1 = element("input");
    			t4 = space();
    			t5 = text(/*agree*/ ctx[1]);
    			t6 = space();
    			hr1 = element("hr");
    			t7 = space();
    			textarea = element("textarea");
    			t8 = space();
    			div = element("div");
    			t9 = text(/*text*/ ctx[2]);
    			t10 = space();
    			hr2 = element("hr");
    			t11 = space();
    			select_1 = element("select");
    			option0 = element("option");
    			t12 = text("Option 0");
    			option1 = element("option");
    			t13 = text("Option 1");
    			option2 = element("option");
    			t14 = text("Option 2");
    			t15 = space();
    			hr3 = element("hr");
    			t16 = space();
    			input2 = element("input");
    			t17 = text(" Female\r\n");
    			input3 = element("input");
    			t18 = text(" Male\r\n");
    			br = element("br");
    			t19 = text("\r\nSex: ");
    			t20 = text(/*sex*/ ctx[4]);
    			this.h();
    		},
    		l(nodes) {
    			h1 = claim_element(nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, /*name*/ ctx[0]);
    			h1_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			input0 = claim_element(nodes, "INPUT", { type: true });
    			t2 = claim_space(nodes);
    			hr0 = claim_element(nodes, "HR", {});
    			t3 = claim_space(nodes);
    			input1 = claim_element(nodes, "INPUT", { type: true });
    			t4 = claim_space(nodes);
    			t5 = claim_text(nodes, /*agree*/ ctx[1]);
    			t6 = claim_space(nodes);
    			hr1 = claim_element(nodes, "HR", {});
    			t7 = claim_space(nodes);

    			textarea = claim_element(nodes, "TEXTAREA", {
    				name: true,
    				id: true,
    				cols: true,
    				rows: true
    			});

    			children(textarea).forEach(detach);
    			t8 = claim_space(nodes);
    			div = claim_element(nodes, "DIV", { style: true });
    			var div_nodes = children(div);
    			t9 = claim_text(div_nodes, /*text*/ ctx[2]);
    			div_nodes.forEach(detach);
    			t10 = claim_space(nodes);
    			hr2 = claim_element(nodes, "HR", {});
    			t11 = claim_space(nodes);
    			select_1 = claim_element(nodes, "SELECT", {});
    			var select_1_nodes = children(select_1);
    			option0 = claim_element(select_1_nodes, "OPTION", {});
    			var option0_nodes = children(option0);
    			t12 = claim_text(option0_nodes, "Option 0");
    			option0_nodes.forEach(detach);
    			option1 = claim_element(select_1_nodes, "OPTION", {});
    			var option1_nodes = children(option1);
    			t13 = claim_text(option1_nodes, "Option 1");
    			option1_nodes.forEach(detach);
    			option2 = claim_element(select_1_nodes, "OPTION", {});
    			var option2_nodes = children(option2);
    			t14 = claim_text(option2_nodes, "Option 2");
    			option2_nodes.forEach(detach);
    			select_1_nodes.forEach(detach);
    			t15 = claim_space(nodes);
    			hr3 = claim_element(nodes, "HR", {});
    			t16 = claim_space(nodes);
    			input2 = claim_element(nodes, "INPUT", { type: true });
    			t17 = claim_text(nodes, " Female\r\n");
    			input3 = claim_element(nodes, "INPUT", { type: true });
    			t18 = claim_text(nodes, " Male\r\n");
    			br = claim_element(nodes, "BR", {});
    			t19 = claim_text(nodes, "\r\nSex: ");
    			t20 = claim_text(nodes, /*sex*/ ctx[4]);
    			this.h();
    		},
    		h() {
    			attr(input0, "type", "text");
    			attr(input1, "type", "checkbox");
    			attr(textarea, "name", "");
    			attr(textarea, "id", "");
    			attr(textarea, "cols", "30");
    			attr(textarea, "rows", "10");
    			set_style(div, "white-space", "pre-wrap");
    			option0.__value = "0";
    			option0.value = option0.__value;
    			option1.__value = "1";
    			option1.value = option1.__value;
    			option2.__value = "2";
    			option2.value = option2.__value;
    			if (/*select*/ ctx[3] === void 0) add_render_callback(() => /*select_1_change_handler*/ ctx[8].call(select_1));
    			attr(input2, "type", "radio");
    			input2.__value = "female";
    			input2.value = input2.__value;
    			/*$$binding_groups*/ ctx[10][0].push(input2);
    			attr(input3, "type", "radio");
    			input3.__value = "male";
    			input3.value = input3.__value;
    			/*$$binding_groups*/ ctx[10][0].push(input3);
    		},
    		m(target, anchor) {
    			insert_hydration(target, h1, anchor);
    			append_hydration(h1, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, input0, anchor);
    			set_input_value(input0, /*name*/ ctx[0]);
    			insert_hydration(target, t2, anchor);
    			insert_hydration(target, hr0, anchor);
    			insert_hydration(target, t3, anchor);
    			insert_hydration(target, input1, anchor);
    			input1.checked = /*agree*/ ctx[1];
    			insert_hydration(target, t4, anchor);
    			insert_hydration(target, t5, anchor);
    			insert_hydration(target, t6, anchor);
    			insert_hydration(target, hr1, anchor);
    			insert_hydration(target, t7, anchor);
    			insert_hydration(target, textarea, anchor);
    			set_input_value(textarea, /*text*/ ctx[2]);
    			insert_hydration(target, t8, anchor);
    			insert_hydration(target, div, anchor);
    			append_hydration(div, t9);
    			insert_hydration(target, t10, anchor);
    			insert_hydration(target, hr2, anchor);
    			insert_hydration(target, t11, anchor);
    			insert_hydration(target, select_1, anchor);
    			append_hydration(select_1, option0);
    			append_hydration(option0, t12);
    			append_hydration(select_1, option1);
    			append_hydration(option1, t13);
    			append_hydration(select_1, option2);
    			append_hydration(option2, t14);
    			select_option(select_1, /*select*/ ctx[3]);
    			insert_hydration(target, t15, anchor);
    			insert_hydration(target, hr3, anchor);
    			insert_hydration(target, t16, anchor);
    			insert_hydration(target, input2, anchor);
    			input2.checked = input2.__value === /*sex*/ ctx[4];
    			insert_hydration(target, t17, anchor);
    			insert_hydration(target, input3, anchor);
    			input3.checked = input3.__value === /*sex*/ ctx[4];
    			insert_hydration(target, t18, anchor);
    			insert_hydration(target, br, anchor);
    			insert_hydration(target, t19, anchor);
    			insert_hydration(target, t20, anchor);

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[5]),
    					listen(input1, "change", /*input1_change_handler*/ ctx[6]),
    					listen(textarea, "input", /*textarea_input_handler*/ ctx[7]),
    					listen(select_1, "change", /*select_1_change_handler*/ ctx[8]),
    					listen(input2, "change", /*input2_change_handler*/ ctx[9]),
    					listen(input3, "change", /*input3_change_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data(t0, /*name*/ ctx[0]);

    			if (dirty & /*name*/ 1 && input0.value !== /*name*/ ctx[0]) {
    				set_input_value(input0, /*name*/ ctx[0]);
    			}

    			if (dirty & /*agree*/ 2) {
    				input1.checked = /*agree*/ ctx[1];
    			}

    			if (dirty & /*agree*/ 2) set_data(t5, /*agree*/ ctx[1]);

    			if (dirty & /*text*/ 4) {
    				set_input_value(textarea, /*text*/ ctx[2]);
    			}

    			if (dirty & /*text*/ 4) set_data(t9, /*text*/ ctx[2]);

    			if (dirty & /*select*/ 8) {
    				select_option(select_1, /*select*/ ctx[3]);
    			}

    			if (dirty & /*sex*/ 16) {
    				input2.checked = input2.__value === /*sex*/ ctx[4];
    			}

    			if (dirty & /*sex*/ 16) {
    				input3.checked = input3.__value === /*sex*/ ctx[4];
    			}

    			if (dirty & /*sex*/ 16) set_data(t20, /*sex*/ ctx[4]);
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(input0);
    			if (detaching) detach(t2);
    			if (detaching) detach(hr0);
    			if (detaching) detach(t3);
    			if (detaching) detach(input1);
    			if (detaching) detach(t4);
    			if (detaching) detach(t5);
    			if (detaching) detach(t6);
    			if (detaching) detach(hr1);
    			if (detaching) detach(t7);
    			if (detaching) detach(textarea);
    			if (detaching) detach(t8);
    			if (detaching) detach(div);
    			if (detaching) detach(t10);
    			if (detaching) detach(hr2);
    			if (detaching) detach(t11);
    			if (detaching) detach(select_1);
    			if (detaching) detach(t15);
    			if (detaching) detach(hr3);
    			if (detaching) detach(t16);
    			if (detaching) detach(input2);
    			/*$$binding_groups*/ ctx[10][0].splice(/*$$binding_groups*/ ctx[10][0].indexOf(input2), 1);
    			if (detaching) detach(t17);
    			if (detaching) detach(input3);
    			/*$$binding_groups*/ ctx[10][0].splice(/*$$binding_groups*/ ctx[10][0].indexOf(input3), 1);
    			if (detaching) detach(t18);
    			if (detaching) detach(br);
    			if (detaching) detach(t19);
    			if (detaching) detach(t20);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let name = "Svelte";
    	let agree = false;
    	let text = "";
    	let select = "1";
    	let sex = "Male";

    	const $$binding_groups = [[]];

    	function input0_input_handler() {
    		name = this.value;
    		$$invalidate(0, name);
    	}

    	function input1_change_handler() {
    		agree = this.checked;
    		$$invalidate(1, agree);
    	}

    	function textarea_input_handler() {
    		text = this.value;
    		$$invalidate(2, text);
    	}

    	function select_1_change_handler() {
    		select = select_value(this);
    		$$invalidate(3, select);
    	}

    	function input2_change_handler() {
    		sex = this.__value;
    		$$invalidate(4, sex);
    	}

    	function input3_change_handler() {
    		sex = this.__value;
    		$$invalidate(4, sex);
    	}

    	return [
    		name,
    		agree,
    		text,
    		select,
    		sex,
    		input0_input_handler,
    		input1_change_handler,
    		textarea_input_handler,
    		select_1_change_handler,
    		input2_change_handler,
    		$$binding_groups,
    		input3_change_handler
    	];
    }

    class Bind extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});
    	}
    }

    /* src\routes\IfElse.svelte generated by Svelte v3.43.1 */

    function create_else_block$2(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text("Длинна между 5 и 10");
    		},
    		l(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, "Длинна между 5 и 10");
    			p_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, p, anchor);
    			append_hydration(p, t);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (18:28) 
    function create_if_block_1(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text("Длинна больше 10 символов");
    		},
    		l(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, "Длинна больше 10 символов");
    			p_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, p, anchor);
    			append_hydration(p, t);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (16:0) {#if value.length < 5}
    function create_if_block$1(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text("Длинна меньше 5 символов");
    		},
    		l(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, "Длинна меньше 5 символов");
    			p_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, p, anchor);
    			append_hydration(p, t);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$4(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let input;
    	let t2;
    	let if_block_anchor;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*value*/ ctx[0].length < 5) return create_if_block$1;
    		if (/*value*/ ctx[0].length > 10) return create_if_block_1;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text("Application");
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			this.h();
    		},
    		l(nodes) {
    			h1 = claim_element(nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Application");
    			h1_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			input = claim_element(nodes, "INPUT", { type: true, class: true });
    			t2 = claim_space(nodes);
    			if_block.l(nodes);
    			if_block_anchor = empty();
    			this.h();
    		},
    		h() {
    			attr(input, "type", "text");
    			attr(input, "class", "svelte-1w8191u");
    			toggle_class(input, "red", /*error*/ ctx[1]);
    			toggle_class(input, "green", !/*error*/ ctx[1]);
    		},
    		m(target, anchor) {
    			insert_hydration(target, h1, anchor);
    			append_hydration(h1, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, input, anchor);
    			set_input_value(input, /*value*/ ctx[0]);
    			insert_hydration(target, t2, anchor);
    			if_block.m(target, anchor);
    			insert_hydration(target, if_block_anchor, anchor);

    			if (!mounted) {
    				dispose = listen(input, "input", /*input_input_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				set_input_value(input, /*value*/ ctx[0]);
    			}

    			if (dirty & /*error*/ 2) {
    				toggle_class(input, "red", /*error*/ ctx[1]);
    			}

    			if (dirty & /*error*/ 2) {
    				toggle_class(input, "green", !/*error*/ ctx[1]);
    			}

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(input);
    			if (detaching) detach(t2);
    			if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function isValid(val) {
    	return val.length >= 5 && val.length < 10;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let error;
    	let value = "Hello";

    	function input_input_handler() {
    		value = this.value;
    		$$invalidate(0, value);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*value*/ 1) {
    			$$invalidate(1, error = !isValid(value));
    		}
    	};

    	return [value, error, input_input_handler];
    }

    class IfElse extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src\components\Person.svelte generated by Svelte v3.43.1 */

    function create_else_block$1(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text("Делай что хочешь");
    		},
    		l(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, "Делай что хочешь");
    			p_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, p, anchor);
    			append_hydration(p, t);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (23:4) {#if age < 18}
    function create_if_block(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text("Пиво продавать нельзя");
    		},
    		l(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, "Пиво продавать нельзя");
    			p_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, p, anchor);
    			append_hydration(p, t);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let div;
    	let p0;
    	let t0;
    	let t1_value = /*index*/ ctx[3] + 1 + "";
    	let t1;
    	let t2;
    	let p1;
    	let t3;
    	let strong0;
    	let t4;
    	let t5;
    	let t6;
    	let t7;
    	let p2;
    	let t8;
    	let strong1;
    	let t9;
    	let t10;

    	function select_block_type(ctx, dirty) {
    		if (/*age*/ ctx[1] < 18) return create_if_block;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div = element("div");
    			p0 = element("p");
    			t0 = text("№ ");
    			t1 = text(t1_value);
    			t2 = space();
    			p1 = element("p");
    			t3 = text("Имя: ");
    			strong0 = element("strong");
    			t4 = text(/*name*/ ctx[0]);
    			t5 = text(" / ");
    			t6 = text(/*copy*/ ctx[4]);
    			t7 = space();
    			p2 = element("p");
    			t8 = text("Занятие: ");
    			strong1 = element("strong");
    			t9 = text(/*job*/ ctx[2]);
    			t10 = space();
    			if_block.c();
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			p0 = claim_element(div_nodes, "P", {});
    			var p0_nodes = children(p0);
    			t0 = claim_text(p0_nodes, "№ ");
    			t1 = claim_text(p0_nodes, t1_value);
    			p0_nodes.forEach(detach);
    			t2 = claim_space(div_nodes);
    			p1 = claim_element(div_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t3 = claim_text(p1_nodes, "Имя: ");
    			strong0 = claim_element(p1_nodes, "STRONG", {});
    			var strong0_nodes = children(strong0);
    			t4 = claim_text(strong0_nodes, /*name*/ ctx[0]);
    			strong0_nodes.forEach(detach);
    			t5 = claim_text(p1_nodes, " / ");
    			t6 = claim_text(p1_nodes, /*copy*/ ctx[4]);
    			p1_nodes.forEach(detach);
    			t7 = claim_space(div_nodes);
    			p2 = claim_element(div_nodes, "P", {});
    			var p2_nodes = children(p2);
    			t8 = claim_text(p2_nodes, "Занятие: ");
    			strong1 = claim_element(p2_nodes, "STRONG", {});
    			var strong1_nodes = children(strong1);
    			t9 = claim_text(strong1_nodes, /*job*/ ctx[2]);
    			strong1_nodes.forEach(detach);
    			p2_nodes.forEach(detach);
    			t10 = claim_space(div_nodes);
    			if_block.l(div_nodes);
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "svelte-thfj3");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, p0);
    			append_hydration(p0, t0);
    			append_hydration(p0, t1);
    			append_hydration(div, t2);
    			append_hydration(div, p1);
    			append_hydration(p1, t3);
    			append_hydration(p1, strong0);
    			append_hydration(strong0, t4);
    			append_hydration(p1, t5);
    			append_hydration(p1, t6);
    			append_hydration(div, t7);
    			append_hydration(div, p2);
    			append_hydration(p2, t8);
    			append_hydration(p2, strong1);
    			append_hydration(strong1, t9);
    			append_hydration(div, t10);
    			if_block.m(div, null);
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*index*/ 8 && t1_value !== (t1_value = /*index*/ ctx[3] + 1 + "")) set_data(t1, t1_value);
    			if (dirty & /*name*/ 1) set_data(t4, /*name*/ ctx[0]);
    			if (dirty & /*job*/ 4) set_data(t9, /*job*/ ctx[2]);

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    		}
    	};
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { name = 'Undefined name' } = $$props;
    	let { age = 'Undefined age' } = $$props;
    	let { job = 'Undefined job' } = $$props;
    	let { index = '1' } = $$props;
    	let copy = name;

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('age' in $$props) $$invalidate(1, age = $$props.age);
    		if ('job' in $$props) $$invalidate(2, job = $$props.job);
    		if ('index' in $$props) $$invalidate(3, index = $$props.index);
    	};

    	return [name, age, job, index, copy];
    }

    class Person extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { name: 0, age: 1, job: 2, index: 3 });
    	}
    }

    /* src\routes\Components.svelte generated by Svelte v3.43.1 */

    function create_fragment$2(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let person0;
    	let t2;
    	let person1;
    	let t3;
    	let person2;
    	let current;

    	person0 = new Person({
    			props: {
    				name: /*people*/ ctx[0][0].name,
    				age: /*people*/ ctx[0][0].age,
    				job: /*people*/ ctx[0][0].job
    			}
    		});

    	const person1_spread_levels = [/*people*/ ctx[0][1]];
    	let person1_props = {};

    	for (let i = 0; i < person1_spread_levels.length; i += 1) {
    		person1_props = assign(person1_props, person1_spread_levels[i]);
    	}

    	person1 = new Person({ props: person1_props });
    	person2 = new Person({ props: { name, age, job } });

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text("Application");
    			t1 = space();
    			create_component(person0.$$.fragment);
    			t2 = space();
    			create_component(person1.$$.fragment);
    			t3 = space();
    			create_component(person2.$$.fragment);
    		},
    		l(nodes) {
    			h1 = claim_element(nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Application");
    			h1_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			claim_component(person0.$$.fragment, nodes);
    			t2 = claim_space(nodes);
    			claim_component(person1.$$.fragment, nodes);
    			t3 = claim_space(nodes);
    			claim_component(person2.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			insert_hydration(target, h1, anchor);
    			append_hydration(h1, t0);
    			insert_hydration(target, t1, anchor);
    			mount_component(person0, target, anchor);
    			insert_hydration(target, t2, anchor);
    			mount_component(person1, target, anchor);
    			insert_hydration(target, t3, anchor);
    			mount_component(person2, target, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const person1_changes = (dirty & /*people*/ 1)
    			? get_spread_update(person1_spread_levels, [get_spread_object(/*people*/ ctx[0][1])])
    			: {};

    			person1.$set(person1_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(person0.$$.fragment, local);
    			transition_in(person1.$$.fragment, local);
    			transition_in(person2.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(person0.$$.fragment, local);
    			transition_out(person1.$$.fragment, local);
    			transition_out(person2.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			destroy_component(person0, detaching);
    			if (detaching) detach(t2);
    			destroy_component(person1, detaching);
    			if (detaching) detach(t3);
    			destroy_component(person2, detaching);
    		}
    	};
    }

    let name = 'Igor';
    let age = 20;
    let job = 'Backend';

    function instance$2($$self) {
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

    	return [people];
    }

    class Components extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});
    	}
    }

    /* src\routes\Cycle.svelte generated by Svelte v3.43.1 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i].name;
    	child_ctx[2] = list[i].age;
    	child_ctx[3] = list[i].job;
    	child_ctx[10] = list[i].id;
    	child_ctx[12] = i;
    	return child_ctx;
    }

    // (48:0) {:else}
    function create_else_block(ctx) {
    	let p;
    	let t;

    	return {
    		c() {
    			p = element("p");
    			t = text("Людей не осталось");
    		},
    		l(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t = claim_text(p_nodes, "Людей не осталось");
    			p_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, p, anchor);
    			append_hydration(p, t);
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    		}
    	};
    }

    // (45:0) {#each people as {name, age, job, id}
    function create_each_block(key_1, ctx) {
    	let first;
    	let person;
    	let current;

    	person = new Person({
    			props: {
    				name: /*name*/ ctx[9],
    				age: /*age*/ ctx[2],
    				job: /*job*/ ctx[3],
    				index: /*i*/ ctx[12]
    			}
    		});

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			first = empty();
    			create_component(person.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			first = empty();
    			claim_component(person.$$.fragment, nodes);
    			this.h();
    		},
    		h() {
    			this.first = first;
    		},
    		m(target, anchor) {
    			insert_hydration(target, first, anchor);
    			mount_component(person, target, anchor);
    			current = true;
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			const person_changes = {};
    			if (dirty & /*people*/ 1) person_changes.name = /*name*/ ctx[9];
    			if (dirty & /*people*/ 1) person_changes.age = /*age*/ ctx[2];
    			if (dirty & /*people*/ 1) person_changes.job = /*job*/ ctx[3];
    			if (dirty & /*people*/ 1) person_changes.index = /*i*/ ctx[12];
    			person.$set(person_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(person.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(person.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(first);
    			destroy_component(person, detaching);
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let h1;
    	let t0;
    	let t1;
    	let input0;
    	let t2;
    	let input1;
    	let t3;
    	let input2;
    	let t4;
    	let button0;
    	let t5;
    	let t6;
    	let button1;
    	let t7;
    	let t8;
    	let hr;
    	let t9;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let each_1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*people*/ ctx[0];
    	const get_key = ctx => /*id*/ ctx[10];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block();
    	}

    	return {
    		c() {
    			h1 = element("h1");
    			t0 = text("Циклы");
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			input1 = element("input");
    			t3 = space();
    			input2 = element("input");
    			t4 = space();
    			button0 = element("button");
    			t5 = text("Добавить человека");
    			t6 = space();
    			button1 = element("button");
    			t7 = text("Удалить первого человека");
    			t8 = space();
    			hr = element("hr");
    			t9 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			this.h();
    		},
    		l(nodes) {
    			h1 = claim_element(nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Циклы");
    			h1_nodes.forEach(detach);
    			t1 = claim_space(nodes);
    			input0 = claim_element(nodes, "INPUT", { type: true, placeholder: true });
    			t2 = claim_space(nodes);
    			input1 = claim_element(nodes, "INPUT", { type: true, placeholder: true });
    			t3 = claim_space(nodes);
    			input2 = claim_element(nodes, "INPUT", { type: true, placeholder: true });
    			t4 = claim_space(nodes);
    			button0 = claim_element(nodes, "BUTTON", {});
    			var button0_nodes = children(button0);
    			t5 = claim_text(button0_nodes, "Добавить человека");
    			button0_nodes.forEach(detach);
    			t6 = claim_space(nodes);
    			button1 = claim_element(nodes, "BUTTON", {});
    			var button1_nodes = children(button1);
    			t7 = claim_text(button1_nodes, "Удалить первого человека");
    			button1_nodes.forEach(detach);
    			t8 = claim_space(nodes);
    			hr = claim_element(nodes, "HR", {});
    			t9 = claim_space(nodes);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(nodes);
    			}

    			each_1_anchor = empty();

    			if (each_1_else) {
    				each_1_else.l(nodes);
    			}

    			this.h();
    		},
    		h() {
    			attr(input0, "type", "text");
    			attr(input0, "placeholder", "Имя");
    			attr(input1, "type", "text");
    			attr(input1, "placeholder", "Возраст");
    			attr(input2, "type", "text");
    			attr(input2, "placeholder", "Job");
    		},
    		m(target, anchor) {
    			insert_hydration(target, h1, anchor);
    			append_hydration(h1, t0);
    			insert_hydration(target, t1, anchor);
    			insert_hydration(target, input0, anchor);
    			set_input_value(input0, /*value*/ ctx[1]);
    			insert_hydration(target, t2, anchor);
    			insert_hydration(target, input1, anchor);
    			set_input_value(input1, /*age*/ ctx[2]);
    			insert_hydration(target, t3, anchor);
    			insert_hydration(target, input2, anchor);
    			set_input_value(input2, /*job*/ ctx[3]);
    			insert_hydration(target, t4, anchor);
    			insert_hydration(target, button0, anchor);
    			append_hydration(button0, t5);
    			insert_hydration(target, t6, anchor);
    			insert_hydration(target, button1, anchor);
    			append_hydration(button1, t7);
    			insert_hydration(target, t8, anchor);
    			insert_hydration(target, hr, anchor);
    			insert_hydration(target, t9, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_hydration(target, each_1_anchor, anchor);

    			if (each_1_else) {
    				each_1_else.m(target, anchor);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen(input2, "input", /*input2_input_handler*/ ctx[8]),
    					listen(button0, "click", /*addPerson*/ ctx[5]),
    					listen(button1, "click", /*removeFirst*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*value*/ 2 && input0.value !== /*value*/ ctx[1]) {
    				set_input_value(input0, /*value*/ ctx[1]);
    			}

    			if (dirty & /*age*/ 4 && input1.value !== /*age*/ ctx[2]) {
    				set_input_value(input1, /*age*/ ctx[2]);
    			}

    			if (dirty & /*job*/ 8 && input2.value !== /*job*/ ctx[3]) {
    				set_input_value(input2, /*job*/ ctx[3]);
    			}

    			if (dirty & /*people*/ 1) {
    				each_value = /*people*/ ctx[0];
    				group_outros();
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, each_1_anchor.parentNode, outro_and_destroy_block, create_each_block, each_1_anchor, get_each_context);
    				check_outros();

    				if (each_value.length) {
    					if (each_1_else) {
    						each_1_else.d(1);
    						each_1_else = null;
    					}
    				} else if (!each_1_else) {
    					each_1_else = create_else_block();
    					each_1_else.c();
    					each_1_else.m(each_1_anchor.parentNode, each_1_anchor);
    				}
    			}
    		},
    		i(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o(local) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(h1);
    			if (detaching) detach(t1);
    			if (detaching) detach(input0);
    			if (detaching) detach(t2);
    			if (detaching) detach(input1);
    			if (detaching) detach(t3);
    			if (detaching) detach(input2);
    			if (detaching) detach(t4);
    			if (detaching) detach(button0);
    			if (detaching) detach(t6);
    			if (detaching) detach(button1);
    			if (detaching) detach(t8);
    			if (detaching) detach(hr);
    			if (detaching) detach(t9);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d(detaching);
    			}

    			if (detaching) detach(each_1_anchor);
    			if (each_1_else) each_1_else.d(detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
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

    	function removeFirst() {
    		$$invalidate(0, people = people.slice(1));
    	}

    	function addPerson() {
    		/*        people = people.concat([{
                id: Date.now,
                name: value
            }])*/
    		$$invalidate(0, people = [...people, { id: Math.random(), name: value, age, job }]);

    		$$invalidate(1, value = $$invalidate(2, age = $$invalidate(3, job = "")));
    		console.log("people", people);
    	}

    	function input0_input_handler() {
    		value = this.value;
    		$$invalidate(1, value);
    	}

    	function input1_input_handler() {
    		age = this.value;
    		$$invalidate(2, age);
    	}

    	function input2_input_handler() {
    		job = this.value;
    		$$invalidate(3, job);
    	}

    	return [
    		people,
    		value,
    		age,
    		job,
    		removeFirst,
    		addPerson,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler
    	];
    }

    class Cycle extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});
    	}
    }

    /* src\App.svelte generated by Svelte v3.43.1 */

    function create_default_slot_15(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Home");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "Home");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (22:4) <NavLink to="variables">
    function create_default_slot_14(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Переменные");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "Переменные");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (23:4) <NavLink to="developments">
    function create_default_slot_13(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("События");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "События");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (24:4) <NavLink to="reactivity">
    function create_default_slot_12(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Реактивность");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "Реактивность");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (25:4) <NavLink to="bind">
    function create_default_slot_11(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("bind");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "bind");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (26:4) <NavLink to="ifelse">
    function create_default_slot_10(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Условные операторы");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "Условные операторы");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (27:4) <NavLink to="components">
    function create_default_slot_9(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Компоненты");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "Компоненты");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (28:4) <NavLink to="cycle">
    function create_default_slot_8(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("Циклы");
    		},
    		l(nodes) {
    			t = claim_text(nodes, "Циклы");
    		},
    		m(target, anchor) {
    			insert_hydration(target, t, anchor);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (32:4) <Route path="/">
    function create_default_slot_7(ctx) {
    	let home;
    	let current;
    	home = new Home({});

    	return {
    		c() {
    			create_component(home.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(home.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(home, detaching);
    		}
    	};
    }

    // (33:4) <Route path="/developments">
    function create_default_slot_6(ctx) {
    	let developments;
    	let current;
    	developments = new Developments({});

    	return {
    		c() {
    			create_component(developments.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(developments.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(developments, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(developments.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(developments.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(developments, detaching);
    		}
    	};
    }

    // (34:4) <Route path="/reactivity">
    function create_default_slot_5(ctx) {
    	let reactivity;
    	let current;
    	reactivity = new Reactivity({});

    	return {
    		c() {
    			create_component(reactivity.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(reactivity.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(reactivity, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(reactivity.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(reactivity.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(reactivity, detaching);
    		}
    	};
    }

    // (35:4) <Route path="/bind">
    function create_default_slot_4(ctx) {
    	let bind_1;
    	let current;
    	bind_1 = new Bind({});

    	return {
    		c() {
    			create_component(bind_1.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(bind_1.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(bind_1, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(bind_1.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(bind_1.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(bind_1, detaching);
    		}
    	};
    }

    // (36:4) <Route path="/ifelse">
    function create_default_slot_3(ctx) {
    	let ifelse;
    	let current;
    	ifelse = new IfElse({});

    	return {
    		c() {
    			create_component(ifelse.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(ifelse.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(ifelse, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(ifelse.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(ifelse.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(ifelse, detaching);
    		}
    	};
    }

    // (37:4) <Route path="/components">
    function create_default_slot_2(ctx) {
    	let components;
    	let current;
    	components = new Components({});

    	return {
    		c() {
    			create_component(components.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(components.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(components, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(components.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(components.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(components, detaching);
    		}
    	};
    }

    // (38:4) <Route path="/cycle">
    function create_default_slot_1(ctx) {
    	let cycle;
    	let current;
    	cycle = new Cycle({});

    	return {
    		c() {
    			create_component(cycle.$$.fragment);
    		},
    		l(nodes) {
    			claim_component(cycle.$$.fragment, nodes);
    		},
    		m(target, anchor) {
    			mount_component(cycle, target, anchor);
    			current = true;
    		},
    		i(local) {
    			if (current) return;
    			transition_in(cycle.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(cycle.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(cycle, detaching);
    		}
    	};
    }

    // (19:2) <Router url="{url}">
    function create_default_slot(ctx) {
    	let nav;
    	let navlink0;
    	let t0;
    	let navlink1;
    	let t1;
    	let navlink2;
    	let t2;
    	let navlink3;
    	let t3;
    	let navlink4;
    	let t4;
    	let navlink5;
    	let t5;
    	let navlink6;
    	let t6;
    	let navlink7;
    	let t7;
    	let div;
    	let route0;
    	let t8;
    	let route1;
    	let t9;
    	let route2;
    	let t10;
    	let route3;
    	let t11;
    	let route4;
    	let t12;
    	let route5;
    	let t13;
    	let route6;
    	let t14;
    	let route7;
    	let current;

    	navlink0 = new NavLink({
    			props: {
    				to: "/",
    				$$slots: { default: [create_default_slot_15] },
    				$$scope: { ctx }
    			}
    		});

    	navlink1 = new NavLink({
    			props: {
    				to: "variables",
    				$$slots: { default: [create_default_slot_14] },
    				$$scope: { ctx }
    			}
    		});

    	navlink2 = new NavLink({
    			props: {
    				to: "developments",
    				$$slots: { default: [create_default_slot_13] },
    				$$scope: { ctx }
    			}
    		});

    	navlink3 = new NavLink({
    			props: {
    				to: "reactivity",
    				$$slots: { default: [create_default_slot_12] },
    				$$scope: { ctx }
    			}
    		});

    	navlink4 = new NavLink({
    			props: {
    				to: "bind",
    				$$slots: { default: [create_default_slot_11] },
    				$$scope: { ctx }
    			}
    		});

    	navlink5 = new NavLink({
    			props: {
    				to: "ifelse",
    				$$slots: { default: [create_default_slot_10] },
    				$$scope: { ctx }
    			}
    		});

    	navlink6 = new NavLink({
    			props: {
    				to: "components",
    				$$slots: { default: [create_default_slot_9] },
    				$$scope: { ctx }
    			}
    		});

    	navlink7 = new NavLink({
    			props: {
    				to: "cycle",
    				$$slots: { default: [create_default_slot_8] },
    				$$scope: { ctx }
    			}
    		});

    	route0 = new Route({
    			props: { path: "variables", component: Variables }
    		});

    	route1 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			}
    		});

    	route2 = new Route({
    			props: {
    				path: "/developments",
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			}
    		});

    	route3 = new Route({
    			props: {
    				path: "/reactivity",
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			}
    		});

    	route4 = new Route({
    			props: {
    				path: "/bind",
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			}
    		});

    	route5 = new Route({
    			props: {
    				path: "/ifelse",
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			}
    		});

    	route6 = new Route({
    			props: {
    				path: "/components",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			}
    		});

    	route7 = new Route({
    			props: {
    				path: "/cycle",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			nav = element("nav");
    			create_component(navlink0.$$.fragment);
    			t0 = space();
    			create_component(navlink1.$$.fragment);
    			t1 = space();
    			create_component(navlink2.$$.fragment);
    			t2 = space();
    			create_component(navlink3.$$.fragment);
    			t3 = space();
    			create_component(navlink4.$$.fragment);
    			t4 = space();
    			create_component(navlink5.$$.fragment);
    			t5 = space();
    			create_component(navlink6.$$.fragment);
    			t6 = space();
    			create_component(navlink7.$$.fragment);
    			t7 = space();
    			div = element("div");
    			create_component(route0.$$.fragment);
    			t8 = space();
    			create_component(route1.$$.fragment);
    			t9 = space();
    			create_component(route2.$$.fragment);
    			t10 = space();
    			create_component(route3.$$.fragment);
    			t11 = space();
    			create_component(route4.$$.fragment);
    			t12 = space();
    			create_component(route5.$$.fragment);
    			t13 = space();
    			create_component(route6.$$.fragment);
    			t14 = space();
    			create_component(route7.$$.fragment);
    		},
    		l(nodes) {
    			nav = claim_element(nodes, "NAV", {});
    			var nav_nodes = children(nav);
    			claim_component(navlink0.$$.fragment, nav_nodes);
    			t0 = claim_space(nav_nodes);
    			claim_component(navlink1.$$.fragment, nav_nodes);
    			t1 = claim_space(nav_nodes);
    			claim_component(navlink2.$$.fragment, nav_nodes);
    			t2 = claim_space(nav_nodes);
    			claim_component(navlink3.$$.fragment, nav_nodes);
    			t3 = claim_space(nav_nodes);
    			claim_component(navlink4.$$.fragment, nav_nodes);
    			t4 = claim_space(nav_nodes);
    			claim_component(navlink5.$$.fragment, nav_nodes);
    			t5 = claim_space(nav_nodes);
    			claim_component(navlink6.$$.fragment, nav_nodes);
    			t6 = claim_space(nav_nodes);
    			claim_component(navlink7.$$.fragment, nav_nodes);
    			nav_nodes.forEach(detach);
    			t7 = claim_space(nodes);
    			div = claim_element(nodes, "DIV", {});
    			var div_nodes = children(div);
    			claim_component(route0.$$.fragment, div_nodes);
    			t8 = claim_space(div_nodes);
    			claim_component(route1.$$.fragment, div_nodes);
    			t9 = claim_space(div_nodes);
    			claim_component(route2.$$.fragment, div_nodes);
    			t10 = claim_space(div_nodes);
    			claim_component(route3.$$.fragment, div_nodes);
    			t11 = claim_space(div_nodes);
    			claim_component(route4.$$.fragment, div_nodes);
    			t12 = claim_space(div_nodes);
    			claim_component(route5.$$.fragment, div_nodes);
    			t13 = claim_space(div_nodes);
    			claim_component(route6.$$.fragment, div_nodes);
    			t14 = claim_space(div_nodes);
    			claim_component(route7.$$.fragment, div_nodes);
    			div_nodes.forEach(detach);
    		},
    		m(target, anchor) {
    			insert_hydration(target, nav, anchor);
    			mount_component(navlink0, nav, null);
    			append_hydration(nav, t0);
    			mount_component(navlink1, nav, null);
    			append_hydration(nav, t1);
    			mount_component(navlink2, nav, null);
    			append_hydration(nav, t2);
    			mount_component(navlink3, nav, null);
    			append_hydration(nav, t3);
    			mount_component(navlink4, nav, null);
    			append_hydration(nav, t4);
    			mount_component(navlink5, nav, null);
    			append_hydration(nav, t5);
    			mount_component(navlink6, nav, null);
    			append_hydration(nav, t6);
    			mount_component(navlink7, nav, null);
    			insert_hydration(target, t7, anchor);
    			insert_hydration(target, div, anchor);
    			mount_component(route0, div, null);
    			append_hydration(div, t8);
    			mount_component(route1, div, null);
    			append_hydration(div, t9);
    			mount_component(route2, div, null);
    			append_hydration(div, t10);
    			mount_component(route3, div, null);
    			append_hydration(div, t11);
    			mount_component(route4, div, null);
    			append_hydration(div, t12);
    			mount_component(route5, div, null);
    			append_hydration(div, t13);
    			mount_component(route6, div, null);
    			append_hydration(div, t14);
    			mount_component(route7, div, null);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const navlink0_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink0_changes.$$scope = { dirty, ctx };
    			}

    			navlink0.$set(navlink0_changes);
    			const navlink1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink1_changes.$$scope = { dirty, ctx };
    			}

    			navlink1.$set(navlink1_changes);
    			const navlink2_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink2_changes.$$scope = { dirty, ctx };
    			}

    			navlink2.$set(navlink2_changes);
    			const navlink3_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink3_changes.$$scope = { dirty, ctx };
    			}

    			navlink3.$set(navlink3_changes);
    			const navlink4_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink4_changes.$$scope = { dirty, ctx };
    			}

    			navlink4.$set(navlink4_changes);
    			const navlink5_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink5_changes.$$scope = { dirty, ctx };
    			}

    			navlink5.$set(navlink5_changes);
    			const navlink6_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink6_changes.$$scope = { dirty, ctx };
    			}

    			navlink6.$set(navlink6_changes);
    			const navlink7_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				navlink7_changes.$$scope = { dirty, ctx };
    			}

    			navlink7.$set(navlink7_changes);
    			const route1_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route1_changes.$$scope = { dirty, ctx };
    			}

    			route1.$set(route1_changes);
    			const route2_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route2_changes.$$scope = { dirty, ctx };
    			}

    			route2.$set(route2_changes);
    			const route3_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route3_changes.$$scope = { dirty, ctx };
    			}

    			route3.$set(route3_changes);
    			const route4_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route4_changes.$$scope = { dirty, ctx };
    			}

    			route4.$set(route4_changes);
    			const route5_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route5_changes.$$scope = { dirty, ctx };
    			}

    			route5.$set(route5_changes);
    			const route6_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route6_changes.$$scope = { dirty, ctx };
    			}

    			route6.$set(route6_changes);
    			const route7_changes = {};

    			if (dirty & /*$$scope*/ 2) {
    				route7_changes.$$scope = { dirty, ctx };
    			}

    			route7.$set(route7_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(navlink0.$$.fragment, local);
    			transition_in(navlink1.$$.fragment, local);
    			transition_in(navlink2.$$.fragment, local);
    			transition_in(navlink3.$$.fragment, local);
    			transition_in(navlink4.$$.fragment, local);
    			transition_in(navlink5.$$.fragment, local);
    			transition_in(navlink6.$$.fragment, local);
    			transition_in(navlink7.$$.fragment, local);
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			transition_in(route5.$$.fragment, local);
    			transition_in(route6.$$.fragment, local);
    			transition_in(route7.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(navlink0.$$.fragment, local);
    			transition_out(navlink1.$$.fragment, local);
    			transition_out(navlink2.$$.fragment, local);
    			transition_out(navlink3.$$.fragment, local);
    			transition_out(navlink4.$$.fragment, local);
    			transition_out(navlink5.$$.fragment, local);
    			transition_out(navlink6.$$.fragment, local);
    			transition_out(navlink7.$$.fragment, local);
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			transition_out(route5.$$.fragment, local);
    			transition_out(route6.$$.fragment, local);
    			transition_out(route7.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(nav);
    			destroy_component(navlink0);
    			destroy_component(navlink1);
    			destroy_component(navlink2);
    			destroy_component(navlink3);
    			destroy_component(navlink4);
    			destroy_component(navlink5);
    			destroy_component(navlink6);
    			destroy_component(navlink7);
    			if (detaching) detach(t7);
    			if (detaching) detach(div);
    			destroy_component(route0);
    			destroy_component(route1);
    			destroy_component(route2);
    			destroy_component(route3);
    			destroy_component(route4);
    			destroy_component(route5);
    			destroy_component(route6);
    			destroy_component(route7);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
    	let main;
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			}
    		});

    	return {
    		c() {
    			div = element("div");
    			main = element("main");
    			create_component(router.$$.fragment);
    			this.h();
    		},
    		l(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			main = claim_element(div_nodes, "MAIN", {});
    			var main_nodes = children(main);
    			claim_component(router.$$.fragment, main_nodes);
    			main_nodes.forEach(detach);
    			div_nodes.forEach(detach);
    			this.h();
    		},
    		h() {
    			attr(div, "class", "container svelte-8k82ra");
    		},
    		m(target, anchor) {
    			insert_hydration(target, div, anchor);
    			append_hydration(div, main);
    			mount_component(router, main, null);
    			current = true;
    		},
    		p(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 2) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_component(router);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { url = "" } = $$props;

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	return [url];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });
    	}
    }

    // main.js

    new App({
    	target: document.getElementById("app"),
    	hydrate: true
    });

})();
//# sourceMappingURL=bundle.js.map
