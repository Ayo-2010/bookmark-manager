(function () {
  'use strict';

  var titleEl = document.getElementById('title');
  var urlEl = document.getElementById('url');
  var tagsEl = document.getElementById('tags');
  var addBtn = document.getElementById('addBtn');
  var cancelEditBtn = document.getElementById('cancelEdit');
  var listEl = document.getElementById('list');
  var searchEl = document.getElementById('search');
  var tagFiltersEl = document.getElementById('tagFilters');
  var sortEl = document.getElementById('sortBy');
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var exportBtn = document.getElementById('exportBtn');
  var importFile = document.getElementById('importFile');
  var errorEl = document.getElementById('error');

  var STORE = 'bookmark-manager.items';
  var COLORS = ['#0f766e', '#b45309', '#7c3aed', '#be123c', '#1d4ed8', '#047857', '#c2410c', '#0369a1'];

  var items = [];
  var editingId = null;
  var activeTag = null;

  function setError(message) {
    if (message) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    } else {
      errorEl.hidden = true;
    }
  }

  function makeId() {
    return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(sanitizeEntry).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  function writeStore() {
    try {
      localStorage.setItem(STORE, JSON.stringify(items));
    } catch (e) {
      return;
    }
  }

  function normalizeUrl(value) {
    var raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.indexOf(' ') !== -1) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      raw = 'https://' + raw;
    }
    var parsed;
    try {
      parsed = new URL(raw);
    } catch (e) {
      return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    if (parsed.hostname.indexOf('.') === -1 && parsed.hostname !== 'localhost') return null;
    return parsed.href;
  }

  function parseTags(value) {
    var seen = {};
    return String(value || '').split(',')
      .map(function (tag) { return tag.trim().replace(/\s+/g, ' '); })
      .filter(function (tag) { return tag.length > 0; })
      .filter(function (tag) {
        var key = tag.toLowerCase();
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  function sanitizeEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    var title = String(entry.title || '').trim();
    var url = normalizeUrl(entry.url);
    if (!title || !url) return null;
    var tags = Array.isArray(entry.tags) ? parseTags(entry.tags.join(',')) : parseTags(entry.tags);
    var added = Number(entry.added);
    return {
      id: typeof entry.id === 'string' && entry.id ? entry.id : makeId(),
      title: title.slice(0, 200),
      url: url,
      tags: tags,
      added: isFinite(added) && added > 0 ? added : Date.now()
    };
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return url;
    }
  }

  function colorFor(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 9973;
    }
    return COLORS[hash % COLORS.length];
  }

  function allTags() {
    var seen = {};
    var out = [];
    items.forEach(function (item) {
      item.tags.forEach(function (tag) {
        var key = tag.toLowerCase();
        if (!seen[key]) {
          seen[key] = true;
          out.push(tag);
        }
      });
    });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  }

  function updateCount() {
    var tags = allTags();
    var label = items.length === 1 ? 'bookmark' : 'bookmarks';
    var tagLabel = tags.length === 1 ? 'tag' : 'tags';
    countEl.textContent = items.length + ' ' + label + ' · ' + tags.length + ' ' + tagLabel;
  }

  function visibleItems() {
    var query = searchEl.value.trim().toLowerCase();
    var filtered = items.filter(function (item) {
      if (activeTag && !item.tags.some(function (tag) { return tag.toLowerCase() === activeTag.toLowerCase(); })) {
        return false;
      }
      if (!query) return true;
      if (item.title.toLowerCase().indexOf(query) !== -1) return true;
      if (hostOf(item.url).toLowerCase().indexOf(query) !== -1) return true;
      if (item.url.toLowerCase().indexOf(query) !== -1) return true;
      return item.tags.some(function (tag) { return tag.toLowerCase().indexOf(query) !== -1; });
    });

    var order = sortEl.value;
    filtered.sort(function (a, b) {
      if (order === 'oldest') return a.added - b.added;
      if (order === 'title') return a.title.localeCompare(b.title);
      return b.added - a.added;
    });
    return filtered;
  }

  function renderTagFilters() {
    tagFiltersEl.textContent = '';
    var tags = allTags();
    if (!tags.length) return;

    tags.forEach(function (tag) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip' + (activeTag && activeTag.toLowerCase() === tag.toLowerCase() ? ' active' : '');
      chip.textContent = tag;
      chip.addEventListener('click', function () {
        activeTag = activeTag && activeTag.toLowerCase() === tag.toLowerCase() ? null : tag;
        render();
      });
      tagFiltersEl.appendChild(chip);
    });
  }

  function buildCard(item) {
    var li = document.createElement('li');
    li.className = 'bookmark';

    var avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.background = colorFor(item.title);
    avatar.textContent = item.title.charAt(0).toUpperCase();

    var body = document.createElement('div');
    body.className = 'bm-body';

    var title = document.createElement('h3');
    title.className = 'bm-title';
    title.textContent = item.title;

    var host = document.createElement('a');
    host.className = 'bm-host';
    host.href = item.url;
    host.target = '_blank';
    host.rel = 'noopener noreferrer';
    host.textContent = hostOf(item.url);

    var meta = document.createElement('p');
    meta.className = 'bm-meta';
    item.tags.forEach(function (tag) {
      var chip = document.createElement('span');
      chip.className = 'tag';
      chip.textContent = tag;
      meta.appendChild(chip);
    });
    var date = document.createElement('span');
    date.className = 'bm-date';
    date.textContent = new Date(item.added).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    meta.appendChild(date);

    body.appendChild(title);
    body.appendChild(host);
    body.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'bm-actions';

    var open = document.createElement('a');
    open.className = 'action';
    open.href = item.url;
    open.target = '_blank';
    open.rel = 'noopener noreferrer';
    open.textContent = 'Open';

    var edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'action';
    edit.textContent = 'Edit';
    edit.addEventListener('click', function () { startEdit(item.id); });

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'action danger';
    del.textContent = 'Delete';
    del.addEventListener('click', function () { remove(item.id); });

    actions.appendChild(open);
    actions.appendChild(edit);
    actions.appendChild(del);

    li.appendChild(avatar);
    li.appendChild(body);
    li.appendChild(actions);
    return li;
  }

  function render() {
    var visible = visibleItems();
    listEl.textContent = '';
    visible.forEach(function (item) {
      listEl.appendChild(buildCard(item));
    });

    if (!visible.length) {
      emptyEl.hidden = false;
      emptyEl.textContent = items.length
        ? 'No bookmarks match your search or filter.'
        : 'No bookmarks yet. Add your first one above.';
    } else {
      emptyEl.hidden = true;
    }

    renderTagFilters();
    updateCount();
  }

  function resetForm() {
    titleEl.value = '';
    urlEl.value = '';
    tagsEl.value = '';
    editingId = null;
    addBtn.textContent = 'Add bookmark';
    cancelEditBtn.hidden = true;
    setError('');
  }

  function submit() {
    var title = titleEl.value.trim();
    var url = normalizeUrl(urlEl.value);
    var tags = parseTags(tagsEl.value);

    if (!title) {
      setError('Please give the bookmark a title.');
      return;
    }
    if (!url) {
      setError('That URL is not valid. Try something like example.com/page.');
      return;
    }

    if (editingId) {
      items = items.map(function (item) {
        if (item.id === editingId) {
          return { id: item.id, title: title, url: url, tags: tags, added: item.added };
        }
        return item;
      });
    } else {
      items.push({ id: makeId(), title: title, url: url, tags: tags, added: Date.now() });
    }

    writeStore();
    resetForm();
    render();
  }

  function startEdit(id) {
    var item = items.filter(function (entry) { return entry.id === id; })[0];
    if (!item) return;
    editingId = id;
    titleEl.value = item.title;
    urlEl.value = item.url;
    tagsEl.value = item.tags.join(', ');
    addBtn.textContent = 'Save changes';
    cancelEditBtn.hidden = false;
    setError('');
    titleEl.focus();
  }

  function remove(id) {
    items = items.filter(function (item) { return item.id !== id; });
    if (editingId === id) resetForm();
    writeStore();
    render();
  }

  function exportData() {
    try {
      var payload = JSON.stringify({ version: 1, bookmarks: items }, null, 2);
      var blob = new Blob([payload], { type: 'application/json' });
      var objectUrl = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'bookmarks.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1500);
    } catch (e) {
      setError('Export is not available in this browser.');
    }
  }

  function importData(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result));
        var incoming = Array.isArray(parsed) ? parsed : parsed.bookmarks;
        if (!Array.isArray(incoming)) throw new Error('bad shape');
        var added = 0;
        incoming.forEach(function (entry) {
          var clean = sanitizeEntry(entry);
          if (clean) {
            clean.id = makeId();
            items.push(clean);
            added += 1;
          }
        });
        if (!added) {
          setError('No valid bookmarks were found in that file.');
          return;
        }
        writeStore();
        resetForm();
        render();
      } catch (e) {
        setError('That file could not be read as a bookmark export.');
      }
    };
    reader.onerror = function () {
      setError('That file could not be read.');
    };
    reader.readAsText(file);
  }

  addBtn.addEventListener('click', submit);
  cancelEditBtn.addEventListener('click', resetForm);
  exportBtn.addEventListener('click', exportData);

  importFile.addEventListener('change', function () {
    importData(importFile.files[0]);
    importFile.value = '';
  });

  searchEl.addEventListener('input', render);
  sortEl.addEventListener('change', render);

  [titleEl, urlEl, tagsEl].forEach(function (el) {
    el.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      } else if (event.key === 'Escape' && editingId) {
        resetForm();
      }
    });
  });

  items = readStore();
  render();
})();
