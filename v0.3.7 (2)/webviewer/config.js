/// for bookmaster-v0.3.3
if (!window.wvWindowMessageListener) {
  // console.error("add message EventListener");
  const eventHandlerMap = {
    openFile: function (data) {
      instance.UI.loadDocument(data.blob, { extension: data.extension });
      instance.xfdfString = data.xfdfString;
      instance.targetPage = data.page;
    },
    fitWidth: function (dat) {
      instance.UI.setFitMode(instance.UI.FitMode.FitWidth);
    },
    showAnnotation: function (data) {
      const anno = instance.Core.annotationManager.getAnnotationById(data);
      if (!anno) {
        console.error("annot:" + data + "doesn't exists");
        return;
      }
      instance.Core.annotationManager.deselectAllAnnotations();
      instance.Core.annotationManager.jumpToAnnotation(anno, { verticalOffset: "50%" });
      instance.Core.annotationManager.selectAnnotation(anno);
    },
    showBookPage: function (data) {
      instance.Core.documentViewer.setCurrentPage(data);
    },
    copyCurrentPageLink: function (data) {
      const page = instance.Core.documentViewer.getCurrentPage();
      window.postObsidianBookNoteMessage("copyCurrentPageLink", page);
    },
    setTheme: function(theme) {
      instance.docViewer.setDefaultPageColor(theme.bgcolor); // TODO?
      instance.UI.setTheme(theme.theme);
    }
  }

  window.wvWindowMessageListener = function (event) {
    const data = event.data;
    // console.log("message:",event)
    if (!(event.origin === "app://obsidian.md" || event.origin === "http://localhost") || !data["app"] || data["app"] !== "obsidian-book") return;
    if (eventHandlerMap[data.type]) {
      eventHandlerMap[data.type](data.data);
    }
  };

  this.addEventListener("message", window.wvWindowMessageListener);

  window.postObsidianBookNoteMessage = function (type, data) {
    window.parent.postMessage({
      app: instance.customData["id"],
      type: type,
      data: data,
    }, "*")
  }
}

if (!window.viewerLoadedListener) {
  // console.error("add viewerLoad EventListener");
  window.viewerLoadedListener = function () {

    instance.customData = JSON.parse(instance.UI.getCustomData());

    const { Actions, docViewer } = instance;

    const onTriggered = Actions.GoTo.prototype.onTriggered;
    Actions.GoTo.prototype.onTriggered = function(target, event) {
      if (target === docViewer.getDocument() && event.name === 'Open') { //跳过Open事件
        return;
      }
      onTriggered.apply(this, arguments);
    };

    // 设置初始主题
    if (instance.customData.theme) {
      docViewer.setDefaultPageColor(instance.customData.theme.bgcolor);
      instance.UI.setTheme(instance.customData.theme.theme);
    } else {
      instance.UI.setTheme("dark");
    }

    // 关闭标注overlay
    instance.UI.setAnnotationContentOverlayHandler(anno => {
      return null;
    });
    // 设置中文
    instance.UI.setLanguage("zh_cn");


    // 添加标注回链按钮
    instance.UI.annotationPopup.add([
      {
        type: "actionButton",
        title: "复制回链",
        img: "assets/icons/arrow-up-left-from-circle.svg",
        onClick: () => {
          annots = instance.Core.annotationManager.getSelectedAnnotations();
          if (annots.length) {
            window.postObsidianBookNoteMessage("copyAnnotationLink", {
              id: annots[annots.length - 1].Id,
              ctrlKey: window.event.ctrlKey,
              zoom: instance.Core.documentViewer.getZoom(),
            })
          }
        }
      }
    ])

    instance.UI.textPopup.add([
      {
        type: "actionButton",
        title: "翻译",
        img: "assets/icons/languages.svg",
        onClick: () => {
          const text = instance.Core.documentViewer.getSelectedText();
          if (text.length) {
              window.postObsidianBookNoteMessage("translate", {
              text: text
            });
          }

        }
      }
    ], "textStrikeoutToolButton")


    //
    // instance.UI.disableElements(['toolbarGroup-Shapes']);
    instance.UI.disableElements(['toolbarGroup-Edit']);
    instance.UI.disableElements(['toolbarGroup-Insert']);
    instance.UI.disableElements(['toolbarGroup-FillAndSign']);
    instance.UI.disableElements(['toolbarGroup-Forms']);

    // instance.enableElements(['bookmarksPanel', 'bookmarksPanelButton']);
    // instance.UI.disableElements(['header']);
    // instance.UI.disableElements(['toolsHeader']);
    

    instance.UI.setHeaderItems(function(header) {

      header.getHeader('toolbarGroup-Annotate').delete("shapeToolGroupButton")
      header.getHeader('toolbarGroup-Annotate').delete("freeTextToolGroupButton")

      header.getHeader('toolbarGroup-Annotate').get("underlineToolGroupButton").insertAfter({
        type: "toolGroupButton",
        toolGroup: "rectangleTools",
        dataElement: "shapeToolGroupButton",
        title: "annotation.rectangle",
        headerGroup: "toolbarGroup-Annotate",
      })

      header.getHeader('toolbarGroup-Annotate').get("squigglyToolGroupButton").insertAfter({
        type: "toolGroupButton",
        toolGroup: "freeTextTools",
        dataElement: "freeTextToolGroupButton",
        title: "annotation.freetext",
        headerGroup: "toolbarGroup-Annotate",
      })
    });


    // 设置作者名
    const { annotationManager } = instance.Core;
    annotationManager.setAnnotationDisplayAuthorMap((userId) => {
      return instance.customData.author;
    });

    // 标注修改事件
    annotationManager.addEventListener("annotationChanged", (annotations, action, { imported }) => {
      if (imported) return;

      instance.Core.annotationManager.exportAnnotCommand().then(xfdfString => {
        window.postObsidianBookNoteMessage("annotationChanged", {
          action: action,
          xfdf: xfdfString,
          zoom: instance.Core.documentViewer.getZoom(),
        })
      });

    });


    window.postObsidianBookNoteMessage("viewerLoaded");
  };

  window.addEventListener('viewerLoaded', window.viewerLoadedListener);
}

if (!window.documentLoadedListener) {
  // console.error("add documentLoaded EventListener");
  window.documentLoadedListener = function () {
    console.log("documentLoaded");

    if (instance.targetPage) {
      instance.Core.documentViewer.setCurrentPage(instance.targetPage);
      instance.targetPage = null;
    }

    if (instance.xfdfString) {
      instance.Core.annotationManager.importAnnotations(instance.xfdfString);
    }

    instance.Core.annotationManager.exportAnnotations({ links: false, widgets: false }).then((xfdfString) => {
      window.postObsidianBookNoteMessage("documentLoaded", xfdfString);
    });
    instance.UI.setFitMode(instance.UI.FitMode.FitWidth)

    instance.Core.documentViewer.addEventListener("pageNumberUpdated", (pageNum) => {
      window.postObsidianBookNoteMessage("pageNumberUpdated", pageNum);
    });


  };

  window.addEventListener('documentLoaded', window.documentLoadedListener);
}


