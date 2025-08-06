import { IInputs, IOutputs } from "./generated/ManifestTypes";

export class ImportFile implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _notifyOutputChanged: () => void;
    private _fileInput: HTMLInputElement;
    private _selectedFile: File | null = null;
    private _fileName = "";
    private _fileContent = "";
    private _uploadStatus = "";

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
    }

    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        
        this.createFileUploadInterface();
        this.setupEventListeners();
    }


    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
     */
    public getOutputs(): IOutputs {
        return {
            fileName: this._fileName,
            fileContent: this._fileContent,
            uploadStatus: this._uploadStatus
        };
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    public destroy(): void {
        if (this._fileInput) {
            this._fileInput.removeEventListener('change', this.onFileSelected.bind(this));
        }
    }

    /**
     * Creates the file upload interface
     */
    private createFileUploadInterface(): void {
        this._container.innerHTML = `
            <div class="import-file-container" id="dropZone" tabindex="0">
                <div class="file-icon">📁</div>
                <div class="upload-text">Chọn file hoặc paste hình ảnh</div>
                <div class="upload-hint">Kéo thả file vào đây, click để chọn file, hoặc Ctrl+V để paste hình</div>
                <input type="file" id="fileInput" class="hidden" accept=".xlsx,.xls,.csv,.txt,.json,.pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.bmp">
                <div id="fileInfo" class="file-info hidden">
                    <div class="file-name" id="fileName"></div>
                    <div class="file-size" id="fileSize"></div>
                </div>
                <div id="statusMessage" class="status-message hidden"></div>
            </div>
        `;

        this._fileInput = this._container.querySelector('#fileInput') as HTMLInputElement;
    }

    /**
     * Sets up event listeners for the file upload interface
     */
    private setupEventListeners(): void {
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;

        // Click to open file dialog
        dropZone.addEventListener('click', () => {
            this._fileInput.click();
        });

        // File selection
        this._fileInput.addEventListener('change', this.onFileSelected.bind(this));

        // Drag and drop events
        dropZone.addEventListener('dragover', this.onDragOver.bind(this));
        dropZone.addEventListener('dragleave', this.onDragLeave.bind(this));
        dropZone.addEventListener('drop', this.onDrop.bind(this));

        // Paste events
        dropZone.addEventListener('paste', this.onPaste.bind(this));
        dropZone.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Focus to enable paste functionality
        dropZone.focus();
    }

    /**
     * Handles file selection
     */
    private onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            this._selectedFile = input.files[0];
            this.displayFileInfo();
            this.readFileContent();
        }
    }

    /**
     * Handles drag over event
     */
    private onDragOver(event: DragEvent): void {
        event.preventDefault();
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;
        dropZone.classList.add('dragging');
    }

    /**
     * Handles drag leave event
     */
    private onDragLeave(event: DragEvent): void {
        event.preventDefault();
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;
        dropZone.classList.remove('dragging');
    }

    /**
     * Handles drop event
     */
    private onDrop(event: DragEvent): void {
        event.preventDefault();
        const dropZone = this._container.querySelector('#dropZone') as HTMLDivElement;
        dropZone.classList.remove('dragging');

        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
            this._selectedFile = event.dataTransfer.files[0];
            this.displayFileInfo();
            this.readFileContent();
        }
    }

    /**
     * Handles paste event for images from clipboard
     */
    private onPaste(event: ClipboardEvent): void {
        event.preventDefault();
        
        if (!event.clipboardData) return;

        const items = Array.from(event.clipboardData.items);
        for (const item of items) {
            // Check if the item is an image
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    this._selectedFile = file;
                    this.displayFileInfo();
                    this.readFileContent();
                    this.updateStatus('Hình ảnh đã được paste thành công', 'success');
                    return;
                }
            }
        }
        
        // If no image found in clipboard
        this.updateStatus('Không tìm thấy hình ảnh trong clipboard', 'error');
    }

    /**
     * Handles keyboard events
     */
    private onKeyDown(event: KeyboardEvent): void {
        // Focus back to container if user clicks elsewhere
        if (event.ctrlKey && event.key === 'v') {
            // Paste will be handled by onPaste event
            this.updateStatus('Đang kiểm tra clipboard...', 'info');
        }
    }

    /**
     * Displays file information
     */
    private displayFileInfo(): void {
        if (!this._selectedFile) return;

        const fileInfo = this._container.querySelector('#fileInfo') as HTMLDivElement;
        const fileName = this._container.querySelector('#fileName') as HTMLDivElement;
        const fileSize = this._container.querySelector('#fileSize') as HTMLDivElement;

        // Handle pasted images (may not have proper name)
        const displayName = this._selectedFile.name || `Pasted_Image_${new Date().getTime()}.${this.getImageExtension(this._selectedFile.type)}`;
        
        fileName.textContent = displayName;
        fileSize.textContent = this.formatFileSize(this._selectedFile.size);
        
        fileInfo.classList.remove('hidden');

        this._fileName = displayName;
        this.updateStatus('File đã được chọn và sẵn sàng sử dụng', 'success');
    }

    /**
     * Reads file content as base64
     */
    private readFileContent(): void {
        if (!this._selectedFile) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target && e.target.result) {
                // Convert to base64 (remove data:*/*;base64, prefix)
                const base64String = (e.target.result as string).split(',')[1];
                this._fileContent = base64String;
                this._uploadStatus = 'ready'; // File is ready for Canvas App to use
                this._notifyOutputChanged();
            }
        };
        reader.readAsDataURL(this._selectedFile);
    }

    /**
     * Updates status message
     */
    private updateStatus(message: string, type: 'success' | 'error' | 'info'): void {
        const statusElement = this._container.querySelector('#statusMessage') as HTMLDivElement;
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.classList.remove('hidden');
    }

    /**
     * Formats file size for display
     */
    private formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Gets file extension based on MIME type for pasted images
     */
    private getImageExtension(mimeType: string): string {
        const mimeToExt: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/bmp': 'bmp',
            'image/webp': 'webp',
            'image/svg+xml': 'svg'
        };
        return mimeToExt[mimeType] || 'png';
    }
}
