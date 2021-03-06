import sinon from 'sinon'
import $ from 'jquery'
import driver from '@packages/driver'

import studioRecorder, { StudioRecorder } from './studio-recorder'
import eventManager from '../lib/event-manager'

const createEvent = (props) => {
  return {
    isTrusted: true,
    type: 'click',
    altKey: false,
    crtlKey: false,
    metaKey: false,
    shiftKey: false,
    ...props,
  }
}

describe('StudioRecorder', () => {
  const cyVisitStub = sinon.stub()
  const getSelectorStub = sinon.stub().returns('.selector')
  let instance

  beforeEach(() => {
    instance = new StudioRecorder()

    sinon.stub(instance, 'attachListeners')
    sinon.stub(instance, 'removeListeners')

    driver.$ = sinon.stub().returnsArg(0)

    sinon.stub(eventManager, 'emit')
    sinon.stub(eventManager, 'getCypress').returns({
      cy: {
        visit: cyVisitStub,
      },
      SelectorPlayground: {
        getSelector: getSelectorStub,
      },
      env: () => null,
    })
  })

  afterEach(() => {
    sinon.restore()
  })

  it('exports a singleton by default', () => {
    expect(studioRecorder).to.be.instanceOf(StudioRecorder)
  })

  context('#startLoading', () => {
    it('sets isLoading, isOpen to true', () => {
      instance.startLoading()

      expect(instance.isLoading).to.be.true
      expect(instance.isOpen).to.be.true
    })
  })

  context('#setTestId', () => {
    it('sets testId to id and hasRunnableId to true', () => {
      instance.setTestId('r2')

      expect(instance.testId).to.equal('r2')
      expect(instance.hasRunnableId).to.be.true
    })

    it('does not clear suite id', () => {
      instance.suiteId = 'r1'
      instance.setTestId('r2')

      expect(instance.suiteId).to.equal('r1')
    })
  })

  context('#setSuiteId', () => {
    it('sets suiteId to id and hasRunnableId to true', () => {
      instance.setSuiteId('r1')

      expect(instance.suiteId).to.equal('r1')
      expect(instance.hasRunnableId).to.be.true
    })

    it('clears test id', () => {
      instance.testId = 'r2'
      instance.setSuiteId('r1')

      expect(instance.testId).to.be.null
    })
  })

  context('#start', () => {
    beforeEach(() => {
      sinon.stub(instance, 'visitUrl')
    })

    it('sets isActive, isOpen to true and isLoading to false', () => {
      instance.start(null)

      expect(instance.isActive).to.be.true
      expect(instance.isLoading).to.be.false
      expect(instance.isOpen).to.be.true
    })

    it('clears any existing logs', () => {
      instance.logs = ['log 1', 'log 2']
      instance.start(null)

      expect(instance.logs).to.be.empty
    })

    it('visits url if url has been set', () => {
      instance.url = 'cypress.io'
      instance.start(null)

      expect(instance.visitUrl).to.be.called
    })

    it('attaches listeners to the body', () => {
      instance.start('body')

      expect(instance.attachListeners).to.be.calledWith('body')
    })
  })

  context('#stop', () => {
    beforeEach(() => {
      instance.start()
    })

    it('removes listeners', () => {
      instance.stop()

      expect(instance.removeListeners).to.be.called
    })

    it('sets isActive, isLoading to false and isOpen is true', () => {
      instance.stop()

      expect(instance.isActive).to.be.false
      expect(instance.isOpen).to.be.true
    })
  })

  context('#reset', () => {
    beforeEach(() => {
      instance.start()
    })

    it('removes listeners', () => {
      instance.reset()

      expect(instance.removeListeners).to.be.called
    })

    it('sets isActive, isOpen to false', () => {
      instance.reset()

      expect(instance.isActive).to.be.false
      expect(instance.isOpen).to.be.false
    })

    it('clears logs and url', () => {
      instance.reset()

      expect(instance.logs).to.be.empty
      expect(instance.url).to.be.null
    })

    it('does not remove runnable ids', () => {
      instance.testId = 'r2'
      instance.suiteId = 'r1'
      instance.reset()

      expect(instance.hasRunnableId).to.be.true
    })
  })

  context('#cancel', () => {
    beforeEach(() => {
      instance.start()
    })

    it('removes listeners', () => {
      instance.cancel()

      expect(instance.removeListeners).to.be.called
    })

    it('sets isActive, isOpen to false', () => {
      instance.cancel()

      expect(instance.isActive).to.be.false
      expect(instance.isOpen).to.be.false
    })

    it('clears logs and url', () => {
      instance.logs = ['log 1', 'log 2']
      instance.cancel()

      expect(instance.logs).to.be.empty
      expect(instance.url).to.be.null
    })

    it('removes runnable ids', () => {
      instance.testId = 'r2'
      instance.suiteId = 'r1'
      instance.cancel()

      expect(instance.hasRunnableId).to.be.false
    })
  })

  context('#startSave', () => {
    beforeEach(() => {
      instance.start()
    })

    it('shows save modal if suite', () => {
      instance.suiteId = 'r1'
      instance.startSave()

      expect(instance.saveModalIsOpen).to.be.true
    })

    it('skips modal and goes directly to save if test', () => {
      sinon.stub(instance, 'save')

      instance.testId = 'r2'
      instance.startSave()

      expect(instance.save).to.be.called
    })
  })

  context('#save', () => {
    beforeEach(() => {
      instance.start()
    })

    it('closes save modal', () => {
      instance.showSaveModal()
      instance.save()

      expect(instance.saveModalIsOpen).to.be.false
    })

    it('removes listeners', () => {
      instance.save()

      expect(instance.removeListeners).to.be.called
    })

    it('sets isActive to false and isOpen is true', () => {
      instance.save()

      expect(instance.isActive).to.be.false
      expect(instance.isOpen).to.be.true
    })

    it('emits studio:save with relevant test information', () => {
      const fileDetails = {
        absoluteFile: '/path/to/spec.js',
        line: 10,
        column: 4,
      }
      const logs = ['log 1', 'log 2']

      instance.setFileDetails(fileDetails)
      instance.logs = logs
      instance.testId = 'r2'

      instance.save()

      expect(eventManager.emit).to.be.calledWith('studio:save', {
        fileDetails,
        commands: logs,
        isSuite: false,
        testName: null,
      })
    })

    it('emits studio:save with relevant suite information', () => {
      const fileDetails = {
        absoluteFile: '/path/to/spec.js',
        line: 10,
        column: 4,
      }
      const logs = ['log 1', 'log 2']

      instance.setFileDetails(fileDetails)
      instance.logs = logs
      instance.suiteId = 'r1'

      instance.save('new test name')

      expect(eventManager.emit).to.be.calledWith('studio:save', {
        fileDetails,
        commands: logs,
        isSuite: true,
        testName: 'new test name',
      })
    })
  })

  context('#visitUrl', () => {
    it('visits existing url by default', () => {
      instance.url = 'cypress.io'
      instance.visitUrl()

      expect(cyVisitStub).to.be.calledWith('cypress.io')
    })

    it('visits and sets new url', () => {
      instance.visitUrl('example.com')

      expect(instance.url).to.equal('example.com')
      expect(cyVisitStub).to.be.calledWith('example.com')
    })

    it('adds a log for the visited url', () => {
      instance.visitUrl('cypress.io')

      expect(instance.logs[0].selector).to.be.null
      expect(instance.logs[0].name).to.equal('visit')
      expect(instance.logs[0].message).to.equal('cypress.io')
    })
  })

  context('#getName', () => {
    it('returns the event type by default', () => {
      const $el = $('<div />')
      const name = instance._getName(createEvent({ type: 'click' }), $el)

      expect(name).to.equal('click')
    })

    it('returns select when a select changes', () => {
      const $el = $('<select />')
      const name = instance._getName(createEvent({ type: 'change' }), $el)

      expect(name).to.equal('select')
    })

    it('returns type on keydown', () => {
      const $el = $('<input />')
      const name = instance._getName(createEvent({ type: 'keydown' }), $el)

      expect(name).to.equal('type')
    })

    it('returns check on radio button click', () => {
      const $el = $('<input type="radio" />')
      const name = instance._getName(createEvent({ type: 'click' }), $el)

      expect(name).to.equal('check')
    })

    it('returns check when checkbox is checked', () => {
      const $el = $('<input type="checkbox" checked />')
      const name = instance._getName(createEvent({ type: 'click' }), $el)

      expect(name).to.equal('check')
    })

    it('returns uncheck when checkbox is unchecked', () => {
      const $el = $('<input type="checkbox" />')
      const name = instance._getName(createEvent({ type: 'click' }), $el)

      expect(name).to.equal('uncheck')
    })
  })

  context('#getMessage', () => {
    it('returns null if the event has no value', () => {
      const $el = $('<div />')
      const message = instance._getMessage(createEvent({ type: 'click' }), $el)

      expect(message).to.be.null
    })

    it('returns target value if the event has a value', () => {
      const $el = $('<input value="blue" />')
      const message = instance._getMessage(createEvent({ type: 'change' }), $el)

      expect(message).to.equal('blue')
    })

    it('returns key value on keydown', () => {
      const $el = $('<input />')
      const message = instance._getMessage(createEvent({ type: 'keydown', key: 'a' }), $el)

      expect(message).to.equal('a')
    })

    it('returns wrapped key code for special keys', () => {
      const $el = $('<input />')
      const message = instance._getMessage(createEvent({ type: 'keydown', key: 'Backspace' }), $el)

      expect(message).to.equal('{backspace}')
    })

    it('adds a single modifier key', () => {
      const $el = $('<input />')
      const message = instance._getMessage(createEvent({ type: 'keydown', key: 'a', ctrlKey: true }), $el)

      expect(message).to.equal('{ctrl+a}')
    })

    it('adds a multiple modifier keys', () => {
      const $el = $('<input />')
      const message = instance._getMessage(createEvent({ type: 'keydown', key: 'a', altKey: true, ctrlKey: true }), $el)

      expect(message).to.equal('{alt+ctrl+a}')
    })

    it('does not add shift as modifier key when capital letters are typed', () => {
      const $el = $('<input />')
      const message = instance._getMessage(createEvent({ type: 'keydown', key: 'A', shiftKey: true }), $el)

      expect(message).to.equal('A')
    })

    it('does add shift as modifier key if there are other modifier keys', () => {
      const $el = $('<input />')
      const message = instance._getMessage(createEvent({ type: 'keydown', key: 'A', ctrlKey: true, shiftKey: true }), $el)

      expect(message).to.equal('{ctrl+shift+a}')
    })
  })

  context('#recordEvent', () => {
    beforeEach(() => {
      instance.testId = 'r2'
    })

    it('does not record events not sent by the user', () => {
      instance._recordEvent(createEvent({ isTrusted: false }))

      expect(instance.logs).to.be.empty
    })

    it('uses the selector playground to get a selector for the element', () => {
      const $el = $('<div />')

      instance._recordEvent(createEvent({ target: $el }))

      expect(getSelectorStub).to.be.calledWith($el)
    })

    it('does not record keydown outside of input', () => {
      const $el = $('<div />')

      instance._recordEvent(createEvent({ type: 'keydown', key: 'a', target: $el }))

      expect(instance.logs).to.be.empty
    })

    it('does not record unneeded change events', () => {
      const $el = $('<input />')

      instance._recordEvent(createEvent({ type: 'change', target: $el }))

      expect(instance.logs).to.be.empty
    })

    it('adds events to the command log with incrementing ids', () => {
      const $el1 = $('<div />')
      const $el2 = $('<input />')

      instance._recordEvent(createEvent({ type: 'click', target: $el1 }))
      instance._recordEvent(createEvent({ type: 'keydown', key: 'a', target: $el2 }))

      expect(instance.logs.length).to.equal(2)

      expect(instance.logs[0].id).to.equal(1)
      expect(instance.logs[0].selector).to.equal('.selector')
      expect(instance.logs[0].name).to.equal('click')
      expect(instance.logs[0].message).to.equal(null)

      expect(instance.logs[1].id).to.equal(2)
      expect(instance.logs[1].selector).to.equal('.selector')
      expect(instance.logs[1].name).to.equal('type')
      expect(instance.logs[1].message).to.equal('a')
    })

    it('emits two reporter:log:add events for each log', () => {
      const $el = $('<input />')

      instance._recordEvent(createEvent({ type: 'keydown', key: 'a', target: $el }))

      expect(eventManager.emit).to.be.calledWith('reporter:log:add', {
        hookId: 'r2-studio',
        id: 's1-get',
        instrument: 'command',
        isStudio: true,
        message: '.selector',
        name: 'get',
        numElements: 1,
        number: 1,
        state: 'passed',
        testId: 'r2',
        type: 'parent',
      })

      expect(eventManager.emit).to.be.calledWith('reporter:log:add', {
        hookId: 'r2-studio',
        id: 's1',
        instrument: 'command',
        isStudio: true,
        message: 'a',
        name: 'type',
        numElements: 1,
        number: undefined,
        state: 'passed',
        testId: 'r2',
        type: 'child',
      })
    })

    it('updates an existing log rather than adding a new one when the filter returns true', () => {
      const $el = $('<input />')

      instance._recordEvent(createEvent({ type: 'keydown', key: 'a', target: $el }))
      instance._recordEvent(createEvent({ type: 'keydown', key: 'b', target: $el }))

      expect(instance.logs.length).to.equal(1)

      expect(instance.logs[0].id).to.equal(1)
      expect(instance.logs[0].selector).to.equal('.selector')
      expect(instance.logs[0].name).to.equal('type')
      expect(instance.logs[0].message).to.equal('ab')
    })

    it('emits reporter:log:state:changed with the child log when a log is updated', () => {
      const $el = $('<input />')

      instance._recordEvent(createEvent({ type: 'keydown', key: 'a', target: $el }))
      instance._recordEvent(createEvent({ type: 'keydown', key: 'b', target: $el }))

      expect(eventManager.emit).to.be.calledWith('reporter:log:state:changed', {
        hookId: 'r2-studio',
        id: 's1',
        instrument: 'command',
        isStudio: true,
        message: 'ab',
        name: 'type',
        numElements: 1,
        number: undefined,
        state: 'passed',
        testId: 'r2',
        type: 'child',
      })
    })
  })

  context('#filterLastLog', () => {
    it('does not filter if there are no existing logs', () => {
      const result = instance._filterLastLog('.selector', 'click', null)

      expect(result).to.be.null
    })

    it('does not filter if selectors do not match', () => {
      instance.logs = {
        id: 1,
        selector: '.selector',
        name: 'type',
        message: 'a',
      }

      const result = instance._filterLastLog('.different-selector', 'type', 'b')

      expect(result).to.be.null
    })

    it('combines typing values and modifies original log in place', () => {
      instance.logs = [{
        id: 1,
        selector: '.selector',
        name: 'type',
        message: 'a',
      }]

      const result = instance._filterLastLog('.selector', 'type', 'b')

      expect(result.name).to.equal('type')
      expect(result.message).to.equal('ab')
      expect(instance.logs[0].name).to.equal('type')
      expect(instance.logs[0].message).to.equal('ab')
    })

    it('converts clicks into selects with value and modifies original log in place', () => {
      instance.logs = [{
        id: 1,
        selector: '.selector',
        name: 'click',
        message: null,
      }]

      const result = instance._filterLastLog('.selector', 'select', 'value')

      expect(result.name).to.equal('select')
      expect(result.message).to.equal('value')
      expect(instance.logs[0].name).to.equal('select')
      expect(instance.logs[0].message).to.equal('value')
    })
  })
})
