/**
 * Google Picker: the only way an app with the `drive.file` scope can see a
 * spreadsheet it did not create. The file the user picks becomes available to
 * the app. https://developers.google.com/workspace/drive/picker/guides/overview
 */

const GAPI_SCRIPT = 'https://apis.google.com/js/api.js'

// The small part of the Picker library the app uses.
interface PickerDocument {
  id: string
  name?: string
}
interface PickerResponse {
  action: string
  docs?: PickerDocument[]
}
interface PickerView {
  setIncludeFolders(included: boolean): PickerView
  setMode(mode: string): PickerView
}
interface PickerBuilder {
  setAppId(appId: string): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setLocale(locale: string): PickerBuilder
  setTitle(title: string): PickerBuilder
  addView(view: PickerView): PickerBuilder
  setCallback(callback: (response: PickerResponse) => void): PickerBuilder
  build(): { setVisible(visible: boolean): void }
}
interface PickerLibrary {
  PickerBuilder: new () => PickerBuilder
  DocsView: new (viewId: string) => PickerView
  ViewId: { SPREADSHEETS: string }
  DocsViewMode: { LIST: string }
  Action: { PICKED: string; CANCEL: string }
}
declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void }
  }
}

export interface PickerConfig {
  apiKey: string
  /** Google Cloud project number. */
  appId: string
}

let loading: Promise<PickerLibrary> | null = null

/** The Picker library lives under the same `google` global as Identity Services. */
function pickerLibrary(): PickerLibrary | undefined {
  return (window.google as { picker?: PickerLibrary } | undefined)?.picker
}

function loadPicker(): Promise<PickerLibrary> {
  loading ??= new Promise<PickerLibrary>((resolve, reject) => {
    const fail = () => {
      loading = null
      reject(new Error('Google Picker did not load'))
    }
    const loadModule = () => {
      if (!window.gapi) {
        fail()
        return
      }
      window.gapi.load('picker', () => {
        const library = pickerLibrary()
        if (library) resolve(library)
        else fail()
      })
    }
    if (window.gapi) {
      loadModule()
      return
    }
    const script = document.createElement('script')
    script.src = GAPI_SCRIPT
    script.async = true
    script.onload = loadModule
    script.onerror = fail
    document.head.append(script)
  })
  return loading
}

/** Shows the Picker with the user's spreadsheets; resolves with the picked id or null. */
export async function pickSpreadsheet(
  config: PickerConfig,
  token: string,
  title: string,
): Promise<string | null> {
  const picker = await loadPicker()
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setMode(picker.DocsViewMode.LIST)
    new picker.PickerBuilder()
      .setAppId(config.appId)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setLocale('ru')
      .setTitle(title)
      .addView(view)
      .setCallback((response) => {
        if (response.action === picker.Action.PICKED) resolve(response.docs?.[0]?.id ?? null)
        else if (response.action === picker.Action.CANCEL) resolve(null)
      })
      .build()
      .setVisible(true)
  })
}
