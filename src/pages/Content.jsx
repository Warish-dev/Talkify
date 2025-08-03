import React, { useState, useCallback, Suspense } from 'react'
import ContentCard from '../components/ContentCard'
const CardModal = React.lazy(() => import('../components/CardModal'))
import BulkOperations from '../components/BulkOperations'
import ContentTemplates from '../components/ContentTemplates'
import AdvancedScheduler from '../components/AdvancedScheduler'
import { ContentCardSkeleton, InlineLoader } from '../components/LoadingStates'
import styled from 'styled-components'
import PageLayout from '../layouts/Layout'
import PageHeader from '../components/PageHeader'
import useStore from '../context/store'
import useKeyboardShortcuts, { SHORTCUTS } from '../hooks/useKeyboardShortcuts'
import { AnimatePresence } from 'framer-motion'
import ErrorBoundary from '../components/ErrorBoundary'
import { FiPlus, FiSearch, FiFilter, FiDownload, FiUpload, FiCalendar, FiZap, FiEdit3, FiFileText } from 'react-icons/fi'
import ActionButton from '../components/ActionButton';
import useDebouncedValue from '../hooks/useDebouncedValue';
import Swal from 'sweetalert2';

const Container = styled.div`
  min-height: 100vh;
  padding: 20px;
  background: var(--bg-primary);
`;

const HeaderActions = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const QuickActionButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: var(--transition);
  outline: none;
  
  &:hover, &:focus {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border-color: var(--border-accent);
    transform: scale(1.1);
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`;

const FilterRow = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
  flex-wrap: wrap;
  
  @media (max-width: 768px) {
    gap: 12px;
  }
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--glass-bg);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  transition: var(--transition);
  
  &:focus-within {
    border-color: var(--border-accent);
    box-shadow: var(--focus-ring);
  }
`;

const FilterIcon = styled.div`
  color: var(--text-muted);
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  min-width: 200px;
  
  &::placeholder {
    color: var(--text-muted);
  }
  
  @media (max-width: 768px) {
    min-width: 150px;
  }
`;

const FilterSelect = styled.select`
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  cursor: pointer;
  
  option {
    background: var(--bg-card);
    color: var(--text-primary);
  }
`;

const ResultsInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 12px 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-secondary);
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 80px 20px;
  background: var(--glass-bg);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-xl);
  margin: 40px 0;
  
  h3 {
    font-size: 20px;
    color: var(--text-primary);
    margin-bottom: 8px;
    background: var(--linearPrimaryAccent);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  p {
    color: var(--text-secondary);
    margin-bottom: 24px;
    line-height: 1.6;
  }
`;

const AutoSaveIndicator = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  background: var(--glass-bg);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-md);
  padding: 8px 16px;
  color: var(--color-success);
  font-size: 12px;
  font-weight: 500;
  z-index: 100;
  opacity: ${props => props.visible ? 1 : 0};
  transform: translateY(${props => props.visible ? 0 : -20}px);
  transition: all 0.3s ease;
  pointer-events: none;
`;

const Content = () => {
  // Zustand store
  const {
    contents,
    addContent,
    updateContent,
    deleteContent,
    selectedItems,
    selectionMode,
    toggleSelectionMode,
    toggleItemSelection,
    clearSelection,
    selectAll,
    autoSaving,
    setAutoSaving,
    searchContents,
    getStats
  } = useStore()

  // Local state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingContent, setEditingContent] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [filterType, setFilterType] = useState('All Types')
  const [modalLoading, setModalLoading] = useState(false)

  // Real-time filtered contents
  const filteredContents = React.useMemo(() => {
    let filtered = contents
    
    // Apply search
    if (debouncedSearch) {
      filtered = searchContents(debouncedSearch)
    }
    
    // Apply type filter
    if (filterType !== 'All Types') {
      filtered = filtered.filter(content => content.type === filterType)
    }
    
    return filtered
  }, [contents, debouncedSearch, filterType, searchContents])

  // Real-time stats
  const stats = React.useMemo(() => getStats(), [contents, getStats])

  // Get unique types for filter
  const contentTypes = React.useMemo(() => {
    const types = [...new Set(contents.map(content => content.type))]
    return ['All Types', ...types]
  }, [contents])

  // Keyboard shortcuts
  useKeyboardShortcuts({
    [SHORTCUTS.NEW_CONTENT]: () => handleNewCard(),
    [SHORTCUTS.SEARCH]: (e) => {
      e.preventDefault()
      document.querySelector('input[placeholder*="Search"]')?.focus()
    },
    [SHORTCUTS.SELECT_ALL]: (e) => {
      e.preventDefault()
      if (selectionMode) {
        selectAll()
      }
    },
    [SHORTCUTS.ESCAPE]: () => {
      if (modalOpen) {
        handleCloseModal()
      } else if (selectionMode) {
        toggleSelectionMode()
        clearSelection()
      }
    }
  })

  // Handlers
  const handleAddCard = useCallback(async (cardData) => {
    setModalLoading(true)
    setAutoSaving(true)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500))
      
      if (editingContent) {
        // Update existing content
        updateContent(editingContent.id, cardData)
      } else {
        // Add new content
        addContent(cardData)
      }
      
      // Close modal and reset state
      setModalOpen(false)
      setEditingContent(null)
      
      // Auto-save simulation
      setTimeout(() => setAutoSaving(false), 1000)
    } catch (error) {
      console.error('Error saving content:', error)
      setAutoSaving(false)
    } finally {
      setModalLoading(false)
    }
  }, [addContent, updateContent, editingContent, setAutoSaving])

  const handleEditCard = useCallback((content) => {
    setEditingContent(content)
    setModalOpen(true)
  }, [])

  const handleNewCard = useCallback(() => {
    setEditingContent(null)
    setModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setEditingContent(null)
  }, [])

  const handleDeleteCard = useCallback((id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete this content.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#a084ca',
      cancelButtonColor: '#6366f1',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteContent(id);
        Swal.fire('Deleted!', 'Your content has been deleted.', 'success');
      }
    });
  }, [deleteContent]);
  
  // Import/Export handlers
  const exportData = useCallback(() => {
    const dataStr = JSON.stringify(contents, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `social-planner-content-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [contents])

  const importData = useCallback((e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result)
          if (Array.isArray(importedData)) {
            importedData.forEach(item => addContent(item))
          }
        } catch {
          alert('Error importing data. Please check the file format.')
        }
      }
      reader.readAsText(file)
    }
    e.target.value = '' // Reset input
  }, [addContent])

  // Header configuration
  const headerStats = [
    { value: stats.total, label: 'Total Content' },
    { value: stats.published, label: 'Published' },
    { value: stats.scheduled, label: 'Scheduled' },
    { value: stats.drafts, label: 'Drafts' }
  ]

  const headerActions = (
    <HeaderActions>
    
      <ActionButton variant="secondary" onClick={exportData}>
        <FiDownload />
        Export
      </ActionButton>
      <ActionButton variant="secondary" as="label">
        <FiUpload />
        Import
        <input type="file" accept=".json" onChange={importData} style={{ display: 'none' }} />
      </ActionButton>
      <ActionButton variant="primary" onClick={handleNewCard}>
        <FiPlus />
        Add Content
      </ActionButton>
    </HeaderActions>
  )

  return (
    <PageLayout>
      <Container>
        <AutoSaveIndicator visible={autoSaving}>
          Auto-saving...
        </AutoSaveIndicator>

        <PageHeader 
          title="Content Management"
          subtitle="Create, manage, and schedule your content across all platforms"
          stats={headerStats}
          actions={headerActions}
        />
        
        <FilterRow>
          <FilterGroup>
            <FilterIcon><FiSearch size={16} /></FilterIcon>
            <SearchInput
              type="text"
              placeholder="Search content... (Ctrl+K)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </FilterGroup>
          
          <FilterGroup>
            <FilterIcon><FiFilter size={16} /></FilterIcon>
            <FilterSelect
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              {contentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </FilterSelect>
          </FilterGroup>
        </FilterRow>

        <ResultsInfo>
          <span>Showing {filteredContents.length} of {contents.length} content</span>
          {selectedItems.length > 0 && (
            <span>{selectedItems.length} selected</span>
          )}
        </ResultsInfo>

   
        {/* Content Grid */}
        {filteredContents.length > 0 ? (
          <ContentGrid>
            <AnimatePresence mode="popLayout">
              {filteredContents.map((content) => (
                <ErrorBoundary key={content.id}>
                  <ContentCard
                    {...content}
                    isSelected={selectedItems.includes(content.id)}
                    selectionMode={selectionMode}
                    onClick={() => selectionMode && toggleItemSelection(content.id)}
                    onEdit={() => handleEditCard(content)}
                    onDelete={() => handleDeleteCard(content.id)}
                  />
                </ErrorBoundary>
              ))}
            </AnimatePresence>
          </ContentGrid>
        ) : (
          <EmptyState>
            <h3>No content found</h3>
            <p>
              {searchTerm || filterType !== 'All Types' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Create your first piece of content to get started with planning and scheduling.'
              }
            </p>
            {!searchTerm && filterType === 'All Types' && (
              <ActionButton variant="primary" onClick={handleNewCard}>
                <FiPlus />
                Create Your First Content
              </ActionButton>
            )}
          </EmptyState>
        )}

        {/* Modal */}
        <Suspense fallback={<InlineLoader />}>
          <CardModal
            open={modalOpen}
            onClose={handleCloseModal}
            onAddCard={handleAddCard}
            editCard={editingContent}
            loading={modalLoading}
          />
        </Suspense>
        
        {/* Content Templates */}
        <ContentTemplates
          isOpen={false}
          onClose={() => {}}
          onSelectTemplate={() => {}}
        />
        
        {/* Advanced Scheduler */}
        <AdvancedScheduler
          isOpen={false}
          onClose={() => {}}
          onSchedule={() => {}}
          contentItems={[]}
        />
      </Container>
    </PageLayout>
  )
}

export default Content