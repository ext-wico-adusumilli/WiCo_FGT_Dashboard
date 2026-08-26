import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DAGGrid } from '../DAGGrid'
import { DagStatus } from '../../../types/airflow'

// Mock the theme context
vi.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' })
}))

// Mock the toast context
vi.mock('../../../components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() })
}))

const mockDags: DagStatus[] = [
  {
    dagId: 'test_dag_1',
    displayName: 'Test DAG 1',
    description: 'First test DAG',
    isActive: true,
    isPaused: false,
    lastRunStatus: 'success',
    lastRunTime: '2024-01-15T10:00:00Z',
    nextRunTime: '2024-01-16T10:00:00Z',
    tags: ['test', 'analysis'],
    taskCount: 5,
    successCount: 4,
    failedCount: 0,
    runningCount: 1,
    queuedCount: 0,
    skippedCount: 0
  },
  {
    dagId: 'test_dag_2',
    displayName: 'Test DAG 2',
    description: 'Second test DAG',
    isActive: true,
    isPaused: true,
    lastRunStatus: 'failed',
    lastRunTime: '2024-01-15T09:00:00Z',
    tags: ['test', 'processing'],
    taskCount: 3,
    successCount: 1,
    failedCount: 2,
    runningCount: 0,
    queuedCount: 0,
    skippedCount: 0
  }
]

describe('DAGGrid', () => {
  const mockHandlers = {
    onTriggerDag: vi.fn(),
    onPauseDag: vi.fn(),
    onUnpauseDag: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders DAG cards correctly', () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('Test DAG 1')).toBeInTheDocument()
    expect(screen.getByText('Test DAG 2')).toBeInTheDocument()
    expect(screen.getByText('First test DAG')).toBeInTheDocument()
    expect(screen.getByText('Second test DAG')).toBeInTheDocument()
  })

  it('displays correct status indicators', () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    // Check for success status
    expect(screen.getByText('Success')).toBeInTheDocument()
    
    // Check for failed status
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows loading state correctly', () => {
    render(
      <DAGGrid
        dags={[]}
        loading={true}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('Loading DAGs...')).toBeInTheDocument()
  })

  it('shows empty state when no DAGs', () => {
    render(
      <DAGGrid
        dags={[]}
        loading={false}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('No DAGs Found')).toBeInTheDocument()
  })

  it('handles trigger DAG action', async () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    const triggerButtons = screen.getAllByText('Trigger')
    fireEvent.click(triggerButtons[0])

    await waitFor(() => {
      expect(mockHandlers.onTriggerDag).toHaveBeenCalledWith('test_dag_1', undefined)
    })
  })

  it('handles pause DAG action', async () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    const pauseButtons = screen.getAllByText('Pause')
    fireEvent.click(pauseButtons[0])

    await waitFor(() => {
      expect(mockHandlers.onPauseDag).toHaveBeenCalledWith('test_dag_1')
    })
  })

  it('handles unpause DAG action', async () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    const unpauseButtons = screen.getAllByText('Unpause')
    fireEvent.click(unpauseButtons[0])

    await waitFor(() => {
      expect(mockHandlers.onUnpauseDag).toHaveBeenCalledWith('test_dag_2')
    })
  })

  it('displays task counts correctly', () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    // Check task counts for first DAG
    expect(screen.getByText('5 tasks')).toBeInTheDocument()
    expect(screen.getByText('4 success')).toBeInTheDocument()
    expect(screen.getByText('1 running')).toBeInTheDocument()

    // Check task counts for second DAG
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
    expect(screen.getByText('2 failed')).toBeInTheDocument()
  })

  it('displays tags correctly', () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('analysis')).toBeInTheDocument()
    expect(screen.getByText('processing')).toBeInTheDocument()
  })

  it('shows paused state correctly', () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    // First DAG should not show paused indicator
    const dagCards = screen.getAllByTestId('dag-card')
    expect(dagCards[0]).not.toHaveTextContent('Paused')

    // Second DAG should show paused indicator
    expect(dagCards[1]).toHaveTextContent('Paused')
  })

  it('formats timestamps correctly', () => {
    render(
      <DAGGrid
        dags={mockDags}
        loading={false}
        {...mockHandlers}
      />
    )

    // Should display relative time or formatted time
    expect(screen.getByText(/Last run:/)).toBeInTheDocument()
    expect(screen.getByText(/Next run:/)).toBeInTheDocument()
  })
})