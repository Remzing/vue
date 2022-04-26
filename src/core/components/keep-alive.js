/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type CacheEntry = {
  name: ?string;
  tag: ?string;
  componentInstance: Component;
};

type CacheEntryMap = { [key: string]: ?CacheEntry };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const entry: ?CacheEntry = cache[key]
    if (entry) {
      const name: ?string = entry.name
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry (
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry: ?CacheEntry = cache[key]
  if (entry && (!current || entry.tag !== current.tag)) {
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  abstract: true,

  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  methods: {
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        cache[keyToCache] = {
          name: getComponentName(componentOptions),
          tag,
          componentInstance,
        }
        keys.push(keyToCache)
        // prune oldest entry
        //! 如果配置了 `max` 并且缓存的长度超过了 `this.max`，还要从缓存中删除第一个
        if (this.max && keys.length > parseInt(this.max)) {
          //! 如果要删除的缓存并且组件 `tag` 不是当前渲染组件 `tag`，也执行删除缓存的组件实例的 `$destroy` 方法
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        this.vnodeToCache = null
      }
    }
  },

  created () {
    this.cache = Object.create(null)
    this.keys = []
  },

  destroyed () {
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted () {
    this.cacheVNode()
    //! `<keep-alive>` 组件也是为观测 `include` 和 `exclude` 的变化，对缓存做处理：
    this.$watch('include', val => {
      /* 观测他们的变化执行 `pruneCache` 函数，其实就是对 `cache` 做遍历，
      发现缓存的节点名称和新的规则没有匹配上的时候，就把这个缓存节点从缓存中摘除 */
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated () {
    this.cacheVNode()
  },

  render () {
    const slot = this.$slots.default
    // 获取第一个子元素的 `vnode`
    // ! `<keep-alive>` 只处理第一个子元素
    const vnode: VNode = getFirstComponentChild(slot)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      /* matches` 的逻辑很简单，就是做匹配，分别处理了数组、字符串、正则表达式的情况，
      也就是说我们平时传的 `include` 和 `exclude` 可以是这三种类型的任意一种。
      并且我们的组件名如果满足了配置 `include` 且不匹配或者是配置了 `exclude` 且匹配，
      那么就直接返回这个组件的 `vnode`，否则的话走下一步缓存 */
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) {
        /* 如果命中缓存，则直接从缓存中拿 `vnode` 的组件实例，并且
        重新调整了 key 的顺序放在了最后一个 */
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key)
        keys.push(key)
      } else {
        // delay setting the cache until update
        //! 否则把 `vnode` 设置进缓存
        this.vnodeToCache = vnode
        this.keyToCache = key
      }

      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
