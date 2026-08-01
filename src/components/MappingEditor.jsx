import { useMemo, useRef, useState } from 'react';
import { parseImportedMapping, serializeMapping } from '../domain/mappingStorage.js';

function sourceLabel(source) {
  return `${source.planName} › ${source.categoryGroupName} › ${source.categoryName}`;
}

function groupSources(sourceCategories) {
  const groups = new Map();
  for (const source of sourceCategories) {
    const planGroupKey = source.planName;
    if (!groups.has(planGroupKey)) {
      groups.set(planGroupKey, {
        key: planGroupKey,
        planName: source.planName,
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

export function MappingEditor({ sourceCategories, mapping, planIds, onMappingChange, onMessage, onBack }) {
  const [groupName, setGroupName] = useState('');
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState('');
  const dragState = useRef({ sourceId: null, targetId: null, position: null });
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

  function announceMove(category, position) {
    setReorderAnnouncement(
      `${category.groupName} / ${category.name} moved to position ${position} of ${mapping.unifiedCategories.length}.`,
    );
  }

  function moveCategory(categoryId, targetIndex) {
    const currentIndex = mapping.unifiedCategories.findIndex((category) => category.id === categoryId);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= mapping.unifiedCategories.length || currentIndex === targetIndex) {
      return;
    }

    const nextCategories = [...mapping.unifiedCategories];
    const [movedCategory] = nextCategories.splice(currentIndex, 1);
    nextCategories.splice(targetIndex, 0, movedCategory);
    onMappingChange({ ...mapping, unifiedCategories: nextCategories });
    announceMove(movedCategory, targetIndex + 1);
  }

  function dropCategory(sourceId, targetId, position) {
    if (!sourceId || !targetId || sourceId === targetId) return;

    const currentIndex = mapping.unifiedCategories.findIndex((category) => category.id === sourceId);
    const targetIndex = mapping.unifiedCategories.findIndex((category) => category.id === targetId);
    if (currentIndex < 0 || targetIndex < 0) return;

    let insertionIndex = targetIndex + (position === 'after' ? 1 : 0);
    if (currentIndex < insertionIndex) insertionIndex -= 1;
    moveCategory(sourceId, insertionIndex);
  }

  function clearDrag() {
    dragState.current = { sourceId: null, targetId: null, position: null };
    setDraggedCategoryId(null);
    setDropTarget(null);
  }

  function handleDragPointerDown(event, categoryId) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragState.current = { sourceId: categoryId, targetId: null, position: null };
    setDraggedCategoryId(categoryId);
    setDropTarget(null);
  }

  function handleDragPointerMove(event) {
    if (!dragState.current.sourceId) return;
    event.preventDefault();

    const element = document.elementFromPoint?.(event.clientX, event.clientY);
    const categoryElement = element?.closest?.('[data-category-id]');
    const targetId = categoryElement?.dataset.categoryId;
    if (!targetId || targetId === dragState.current.sourceId) {
      dragState.current.targetId = null;
      dragState.current.position = null;
      setDropTarget(null);
      return;
    }

    const bounds = categoryElement.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    dragState.current.targetId = targetId;
    dragState.current.position = position;
    setDropTarget({ categoryId: targetId, position });
  }

  function handleDragPointerUp(event) {
    if (!dragState.current.sourceId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dropCategory(
      dragState.current.sourceId,
      dragState.current.targetId,
      dragState.current.position,
    );
    clearDrag();
  }

  function handleReorderKeyDown(event, categoryId) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const currentIndex = mapping.unifiedCategories.findIndex((category) => category.id === categoryId);
    const offset = event.key === 'ArrowUp' ? -1 : 1;
    moveCategory(categoryId, currentIndex + offset);
  }

  function handleExport() {
    const blob = new Blob([serializeMapping(mapping)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wnab-mapping.json';
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
        <button type="button" className="back-to-budget" onClick={onBack}><span aria-hidden="true">‹</span> Settings</button>
        <div className="section-heading">
          <div>
            <h2 id="mapping-heading">Map categories</h2>
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
                <legend><strong>{group.planName}</strong></legend>
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
                      <span className="source-name"><strong>{source.categoryName}</strong><small>{source.categoryGroupName}</small></span>
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
              {mapping.unifiedCategories.map((category) => {
                const dropPosition = dropTarget?.categoryId === category.id ? dropTarget.position : null;
                return (
                  <article
                    key={category.id}
                    data-category-id={category.id}
                    className={`mapped-category${draggedCategoryId === category.id ? ' mapped-category-dragging' : ''}${dropPosition ? ` mapped-category-drop-${dropPosition}` : ''}`}
                  >
                    <div className="mapped-category-heading">
                      <div>
                        <span>{category.groupName}</span>
                        <strong>{category.name}</strong>
                      </div>
                      <div className="mapped-category-actions">
                        <button
                          type="button"
                          className="delete-button"
                          onClick={() => deleteCategory(category.id)}
                          aria-label={`Delete ${category.name}`}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="reorder-handle"
                          aria-label={`Reorder ${category.groupName} / ${category.name}. Drag or use arrow keys.`}
                          title="Drag to reorder"
                          disabled={mapping.unifiedCategories.length < 2}
                          onPointerDown={(event) => handleDragPointerDown(event, category.id)}
                          onPointerMove={handleDragPointerMove}
                          onPointerUp={handleDragPointerUp}
                          onPointerCancel={clearDrag}
                          onKeyDown={(event) => handleReorderKeyDown(event, category.id)}
                        >
                          <span aria-hidden="true"><i /><i /><i /></span>
                        </button>
                      </div>
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
                );
              })}
              <p className="sr-only" aria-live="polite">{reorderAnnouncement}</p>
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
