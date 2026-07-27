import { useMemo, useState } from 'react';
import { parseImportedMapping, serializeMapping } from '../domain/mappingStorage.js';

function sourceLabel(source) {
  return `${source.planName} › ${source.categoryGroupName} › ${source.categoryName}`;
}

function groupSources(sourceCategories) {
  const groups = new Map();
  for (const source of sourceCategories) {
    const planGroupKey = `${source.planName}||${source.categoryGroupName}`;
    if (!groups.has(planGroupKey)) {
      groups.set(planGroupKey, {
        key: planGroupKey,
        planName: source.planName,
        categoryGroupName: source.categoryGroupName,
        sources: [],
      });
    }
    groups.get(planGroupKey).sources.push(source);
  }
  return [...groups.values()];
}

function nextUnifiedId(mapping, groupName, name) {
  const base = `${groupName}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'category';
  return `unified-${base}-${mapping.unifiedCategories.length + 1}`;
}

export function MappingEditor({ sourceCategories, mapping, planIds, onMappingChange, onMessage }) {
  const [groupName, setGroupName] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const sourceGroups = useMemo(() => groupSources(sourceCategories), [sourceCategories]);
  const sourceById = useMemo(() => new Map(sourceCategories.map((source) => [source.sourceId, source])), [sourceCategories]);
  const assignedSourceIds = new Set(mapping.unifiedCategories.flatMap((category) => category.sourceIds));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSourceGroups = sourceGroups
    .map((group) => ({
      ...group,
      sources: group.sources.filter((source) => sourceLabel(source).toLowerCase().includes(normalizedQuery)),
    }))
    .filter((group) => group.sources.length > 0);

  function toggleSource(sourceId) {
    setSelectedSourceIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId],
    );
  }

  function handleAdd(event) {
    event.preventDefault();
    if (!groupName.trim() || !name.trim() || selectedSourceIds.length === 0) return;

    onMappingChange({
      ...mapping,
      unifiedCategories: [
        ...mapping.unifiedCategories,
        {
          id: nextUnifiedId(mapping, groupName.trim(), name.trim()),
          groupName: groupName.trim(),
          name: name.trim(),
          sourceIds: selectedSourceIds,
        },
      ],
    });
    setGroupName('');
    setName('');
    setSelectedSourceIds([]);
    setQuery('');
    onMessage?.('Shared category added.');
  }

  function removeSource(categoryId, sourceId) {
    onMappingChange({
      ...mapping,
      unifiedCategories: mapping.unifiedCategories.map((category) =>
        category.id === categoryId
          ? { ...category, sourceIds: category.sourceIds.filter((id) => id !== sourceId) }
          : category,
      ),
    });
  }

  function deleteCategory(categoryId) {
    onMappingChange({
      ...mapping,
      unifiedCategories: mapping.unifiedCategories.filter((category) => category.id !== categoryId),
    });
  }

  function handleExport() {
    const blob = new Blob([serializeMapping(mapping)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'together-budget-mapping.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importFile) return;
    try {
      const text = await importFile.text();
      onMappingChange(parseImportedMapping(text, planIds));
      onMessage?.('Mapping imported.');
    } catch (error) {
      onMessage?.(error.message, 'error');
    }
  }

  return (
    <section className="mapping-editor" aria-labelledby="mapping-heading">
      <div className="section-heading-row">
        <div className="section-heading">
          <div>
            <h2 id="mapping-heading">Match categories</h2>
            <p>Connect categories that mean the same thing across both plans.</p>
          </div>
        </div>
        <details className="mapping-tools">
          <summary>Import or export</summary>
          <div className="mapping-tools-popover">
            <button type="button" className="button button-secondary" onClick={handleExport}>
              Export mapping
            </button>
            <label className="file-label">
              <span>Import a backup</span>
              <input type="file" accept="application/json" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" className="button button-secondary" onClick={handleImport} disabled={!importFile}>
              Import mapping
            </button>
          </div>
        </details>
      </div>

      <div className="mapping-layout">
        <form className="mapping-builder" onSubmit={handleAdd}>
          <div className="builder-header">
            <div>
              <span className="builder-label">New shared category</span>
              <h3>Name it, then choose its sources.</h3>
            </div>
            <span className="selection-count">{selectedSourceIds.length} selected</span>
          </div>

          <div className="name-grid">
            <label>
              <span>Shared group</span>
              <input aria-label="Group name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Everyday" />
            </label>
            <label>
              <span>Shared category</span>
              <input aria-label="Unified category name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Groceries" />
            </label>
          </div>

          <label className="search-field">
            <span>Find source categories</span>
            <span className="search-input-wrap">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search both plans" />
            </span>
          </label>

          <div className="source-list" aria-label="Source categories">
            {filteredSourceGroups.map((group) => (
              <fieldset key={group.key}>
                <legend><strong>{group.planName}</strong><span>{group.categoryGroupName}</span></legend>
                {group.sources.map((source) => {
                  const isAssigned = assignedSourceIds.has(source.sourceId);
                  return (
                    <label key={source.sourceId} className={`source-option${isAssigned ? ' source-option-assigned' : ''}`}>
                      <input
                        type="checkbox"
                        aria-label={sourceLabel(source)}
                        checked={selectedSourceIds.includes(source.sourceId)}
                        disabled={isAssigned}
                        onChange={() => toggleSource(source.sourceId)}
                      />
                      <span className="source-check" aria-hidden="true">✓</span>
                      <span className="source-name">{source.categoryName}</span>
                      {source.hidden ? <span className="badge badge-hidden">Hidden</span> : null}
                      {isAssigned ? <span className="badge badge-mapped">Mapped</span> : null}
                    </label>
                  );
                })}
              </fieldset>
            ))}
            {filteredSourceGroups.length === 0 ? <p className="no-results">No categories match “{query}”.</p> : null}
          </div>

          <button type="submit" aria-label="Add unified category" className="button button-primary button-wide" disabled={!groupName.trim() || !name.trim() || selectedSourceIds.length === 0}>
            Add shared category
          </button>
        </form>

        <div className="mapped-panel">
          <div className="mapped-panel-header">
            <div>
              <span className="builder-label">Your shared structure</span>
              <h3>Mapped categories</h3>
            </div>
            <span className="count-badge">{mapping.unifiedCategories.length}</span>
          </div>

          {mapping.unifiedCategories.length > 0 ? (
            <div className="mapped-list">
              {mapping.unifiedCategories.map((category) => (
                <article key={category.id} className="mapped-category">
                  <div className="mapped-category-heading">
                    <div>
                      <span>{category.groupName}</span>
                      <strong>{category.name}</strong>
                    </div>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => deleteCategory(category.id)}
                      aria-label={`Delete ${category.name}`}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="mapped-source-list">
                    {category.sourceIds.map((sourceId) => {
                      const source = sourceById.get(sourceId);
                      return (
                        <div key={sourceId} className="mapped-source">
                          <span>{source ? sourceLabel(source) : `Missing source / ${sourceId}`}</span>
                          <button type="button" onClick={() => removeSource(category.id, sourceId)} aria-label={`Remove ${sourceId}`}>Remove</button>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mapping-empty-state">
              <h3>No matches yet</h3>
              <p>Create your first shared category using the builder.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
